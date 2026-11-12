"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";

// Service-role client for Auth Admin operations (invite user, list users).
// Secret key never reaches the browser.
function createServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: adminRow, error: adminErr } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminErr) throw new Error(`Error al verificar permisos: ${adminErr.message}`);
  if (!adminRow) throw new Error("Acceso denegado: se requiere platform_admin.");
  return { supabase, user };
}

function adminServiceClient() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function logAudit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown>,
) {
  // Use service role — audit_log has no authenticated INSERT policy
  const svc = adminServiceClient();
  await svc.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export type AdminResult = { error: string | null; data?: Record<string, unknown> };

// ── Create restaurant ─────────────────────────────────────────

export async function createRestaurant(formData: FormData): Promise<AdminResult> {
  const name         = String(formData.get("name") ?? "").trim();
  const slug         = String(formData.get("slug") ?? "").trim().toLowerCase();
  const currency     = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const timezone     = String(formData.get("timezone") ?? "America/Caracas").trim();
  const businessType = String(formData.get("business_type") ?? "restaurant").trim();

  if (!name || name.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    return { error: "El slug solo puede tener minúsculas, dígitos y guiones (3–63 chars)." };
  }
  if (currency.length !== 3) return { error: "La moneda debe tener exactamente 3 letras." };
  if (!["restaurant", "store", "other"].includes(businessType)) {
    return { error: "Tipo de negocio inválido." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { data: restaurant, error } = await supabase.from("restaurants").insert({
    name, slug, currency, timezone, status: "onboarding", business_type: businessType,
  }).select("id, name, slug").single();

  if (error) {
    if (error.code === "23505") return { error: "Este slug ya está en uso." };
    return { error: error.message };
  }

  await logAudit(adminUser.id, "create_restaurant", "restaurant", restaurant.id, {
    name, slug, currency, timezone,
  });

  revalidatePath("/admin");
  return { error: null, data: restaurant as Record<string, unknown> };
}

// ── Update restaurant ─────────────────────────────────────────

export async function updateRestaurant(
  restaurantId: string,
  formData: FormData,
): Promise<AdminResult> {
  const name     = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!name || name.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  if (currency.length !== 3) return { error: "La moneda debe tener exactamente 3 letras." };
  if (!timezone) return { error: "La zona horaria es obligatoria." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("restaurants")
    .update({ name, currency, timezone, updated_at: new Date().toISOString() })
    .eq("id", restaurantId);

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "update_restaurant", "restaurant", restaurantId, {
    name, currency, timezone,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Set restaurant status ─────────────────────────────────────
// Only suspends or reactivates; never deletes.

export async function setRestaurantStatus(
  restaurantId: string,
  newStatus: "onboarding" | "active" | "suspended",
  note: string,
): Promise<AdminResult> {
  if (!note.trim() || note.trim().length < 3) {
    return { error: "Se requiere un motivo de al menos 3 caracteres." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Use service role: restaurants.status is protected by guard_restaurant_status trigger
  // which checks is_platform_admin(). The authenticated client call works since the session
  // IS a platform admin. But service role avoids any edge-case with trigger context.
  const svc = adminServiceClient();
  const { error } = await svc.from("restaurants")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", restaurantId);

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "set_status", "restaurant", restaurantId, {
    new_status: newStatus, note,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Assign owner ──────────────────────────────────────────────
// Flow:
// 1. Look up user by email via Auth Admin API.
// 2. If user exists: create/update membership (role=owner, status=active).
// 3. If user does not exist: create membership as 'invited', then try to
//    send invite via Supabase Auth Admin.
//    If invite fails (no SMTP config, missing SITE_URL), mark as 'pending'
//    and return documentation of what's needed.
// This operation NEVER grants platform_admin.

export async function assignOwner(
  restaurantId: string,
  email: string,
  password?: string,
): Promise<AdminResult & { invitePending?: boolean; inviteNote?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    return { error: "Dirección de correo inválida." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Verify the restaurant exists
  const svc = adminServiceClient();
  const { data: restaurant } = await svc
    .from("restaurants").select("id, name").eq("id", restaurantId).maybeSingle();
  if (!restaurant) return { error: "Restaurante no encontrado." };

  // Look up user by email via Auth Admin API
  // listUsers does not support email filter in all SDK versions;
  // we filter in JS. Acceptable for small user counts (dev/pilot phase).
  const { data: userList, error: listErr } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return { error: `Error al buscar usuario: ${listErr.message}` };

  const existingUser = userList?.users.find(
    (u) => u.email?.toLowerCase() === trimmedEmail,
  );

  if (existingUser) {
    // User already exists — upsert membership
    const { data: existingMember } = await svc
      .from("restaurant_members")
      .select("id, role, status")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMember) {
      // Update to owner/active
      const { error } = await svc
        .from("restaurant_members")
        .update({ role: "owner", status: "active" })
        .eq("id", existingMember.id);
      if (error) return { error: error.message };
    } else {
      // Create new membership
      const { error } = await svc.from("restaurant_members").insert({
        restaurant_id: restaurantId,
        user_id: existingUser.id,
        role: "owner",
        status: "active",
      });
      if (error) return { error: error.message };
    }

    await logAudit(adminUser.id, "assign_owner", "member", restaurantId, {
      email: trimmedEmail, user_id: existingUser.id, method: "existing_user",
    });

    revalidatePath(`/admin/restaurants/${restaurantId}`);
    return {
      error: null,
      data: { method: "existing_user", email: trimmedEmail, userId: existingUser.id },
    };
  }

  // User does not exist.
  // If a password was provided, create the user directly (no SMTP needed).
  // Otherwise, use Supabase's invite flow (requires SMTP).
  if (password) {
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
    });
    if (createErr) return { error: `Error al crear usuario: ${createErr.message}` };
    const newUserId = created.user.id;

    await svc.from("restaurant_members").insert({
      restaurant_id: restaurantId,
      user_id: newUserId,
      role: "owner",
      status: "active",
    });

    await logAudit(adminUser.id, "assign_owner_created", "member", restaurantId, {
      email: trimmedEmail, user_id: newUserId, method: "created_with_password",
      note: "Password set by platform_admin. Value not logged.",
    });

    revalidatePath(`/admin/restaurants/${restaurantId}`);
    return { error: null, data: { method: "created_with_password", email: trimmedEmail, userId: newUserId } };
  }

  // No password provided — use invite flow (requires SITE_URL and SMTP).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    await logAudit(adminUser.id, "assign_owner_pending", "member", restaurantId, {
      email: trimmedEmail, reason: "NEXT_PUBLIC_SITE_URL not set",
    });
    return {
      error: null,
      invitePending: true,
      inviteNote: "NEXT_PUBLIC_SITE_URL no está configurada. Define la variable de entorno y ejecuta de nuevo para enviar la invitación.",
    };
  }

  // Only allow redirect to our own domain
  let redirectTo: string;
  try {
    const base = new URL(siteUrl);
    redirectTo = `${base.origin}/login`;
  } catch {
    return { error: "NEXT_PUBLIC_SITE_URL tiene un formato inválido." };
  }

  // Attempt to invite the user
  const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(
    trimmedEmail,
    { redirectTo },
  );

  if (inviteErr) {
    // Invite failed (no SMTP, etc.) — log as pending
    await logAudit(adminUser.id, "assign_owner_invite_failed", "member", restaurantId, {
      email: trimmedEmail, error: inviteErr.message,
    });
    return {
      error: null,
      invitePending: true,
      inviteNote: `La invitación no pudo enviarse: ${inviteErr.message}. Configura SMTP en el proyecto de Supabase para habilitarla.`,
    };
  }

  // Create membership with the new user's id
  const newUserId = inviteData?.user?.id;
  if (newUserId) {
    await svc.from("restaurant_members").insert({
      restaurant_id: restaurantId,
      user_id: newUserId,
      role: "owner",
      status: "invited",
    });

    // If a password was provided, set it now (value not logged)
    if (password) {
      await svc.auth.admin.updateUserById(newUserId, { password });
    }
  }

  await logAudit(adminUser.id, "assign_owner_invited", "member", restaurantId, {
    email: trimmedEmail, user_id: newUserId, redirect_to: redirectTo,
  });

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null, data: { method: "invited", email: trimmedEmail, userId: newUserId } };
}

// ── Create plan ───────────────────────────────────────────────

export async function createPlan(formData: FormData): Promise<AdminResult> {
  const name        = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceCents  = parseInt(String(formData.get("price_cents") ?? "0"), 10);
  const currency    = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const isTest      = formData.get("is_test") === "true";
  const maxProducts = formData.get("max_products") ? parseInt(String(formData.get("max_products")), 10) : null;
  const maxMembers  = formData.get("max_members")  ? parseInt(String(formData.get("max_members")), 10)  : null;

  if (!name || name.length < 2) return { error: "El nombre del plan debe tener al menos 2 caracteres." };
  if (isNaN(priceCents) || priceCents < 0) return { error: "El precio debe ser un número no negativo." };
  if (currency.length !== 3) return { error: "La moneda debe tener exactamente 3 letras." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { data: plan, error } = await supabase.from("plans").insert({
    name,
    description: description || null,
    price_cents: priceCents,
    currency,
    is_test: isTest,
    max_products: maxProducts,
    max_members: maxMembers,
  }).select("id, name").single();

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "create_plan", "plan", plan.id, {
    name, price_cents: priceCents, currency, is_test: isTest,
  });

  revalidatePath("/admin/planes");
  return { error: null, data: plan as Record<string, unknown> };
}

// ── Create subscription ───────────────────────────────────────

export async function createSubscription(
  restaurantId: string,
  planId: string,
  endsAtStr: string | null,
  notes: string,
): Promise<AdminResult> {
  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const endsAt = endsAtStr ? new Date(endsAtStr).toISOString() : null;
  if (endsAtStr && isNaN(new Date(endsAtStr).getTime())) {
    return { error: "Fecha de vencimiento inválida." };
  }

  const supabase = await createServerClient();
  const { data: sub, error } = await supabase.from("subscriptions").insert({
    restaurant_id: restaurantId,
    plan_id: planId,
    status: "active",
    starts_at: new Date().toISOString(),
    ends_at: endsAt,
    notes: notes.trim() || null,
    created_by: adminUser.id,
  }).select("id").single();

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "create_subscription", "subscription", sub.id, {
    restaurant_id: restaurantId, plan_id: planId, ends_at: endsAt, notes,
  });

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Update subscription status ────────────────────────────────

export async function setSubscriptionStatus(
  subscriptionId: string,
  restaurantId: string,
  newStatus: "active" | "expired" | "cancelled",
  notes: string,
): Promise<AdminResult> {
  if (!notes.trim() || notes.trim().length < 3) {
    return { error: "Se requiere un motivo de al menos 3 caracteres." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("subscriptions")
    .update({ status: newStatus, notes: notes.trim(), updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "set_subscription_status", "subscription", subscriptionId, {
    new_status: newStatus, notes,
  });

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Record payment ────────────────────────────────────────────

export async function recordPayment(
  subscriptionId: string,
  restaurantId: string,
  formData: FormData,
): Promise<AdminResult> {
  const amountCentsRaw = parseFloat(String(formData.get("amount") ?? "0")) * 100;
  const amountCents = Math.round(amountCentsRaw);
  const currency  = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const paidAt    = String(formData.get("paid_at") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes     = String(formData.get("notes") ?? "").trim();

  if (isNaN(amountCents) || amountCents <= 0) return { error: "El importe debe ser mayor que cero." };
  if (currency.length !== 3) return { error: "La moneda debe tener exactamente 3 letras." };
  if (!paidAt || isNaN(new Date(paidAt).getTime())) return { error: "Fecha de pago inválida." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("subscription_payments").insert({
    subscription_id: subscriptionId,
    restaurant_id: restaurantId,
    amount_cents: amountCents,
    currency,
    paid_at: new Date(paidAt).toISOString(),
    reference: reference || null,
    notes: notes || null,
    recorded_by: adminUser.id,
  });

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "record_payment", "payment", subscriptionId, {
    amount_cents: amountCents, currency, paid_at: paidAt, reference,
  });

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Soft-delete restaurant ────────────────────────────────────

export async function softDeleteRestaurant(
  restaurantId: string,
  confirmedName: string,
): Promise<AdminResult> {
  const trimmed = confirmedName.trim();
  if (!trimmed) return { error: "Se requiere el nombre del negocio para confirmar." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Verify name matches before deleting
  const svc = adminServiceClient();
  const { data: restaurant } = await svc
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!restaurant) return { error: "Negocio no encontrado." };
  if (restaurant.name.trim() !== trimmed) {
    return { error: "El nombre no coincide. Escríbelo exactamente como aparece." };
  }

  const { error } = await svc.rpc("soft_delete_restaurant", {
    p_restaurant_id: restaurantId,
  });

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "soft_delete_restaurant", "restaurant", restaurantId, {
    name: restaurant.name,
  });

  revalidatePath("/admin");
  return { error: null };
}

// ── Restore restaurant ────────────────────────────────────────

export async function restoreRestaurant(restaurantId: string): Promise<AdminResult> {
  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();
  const { error } = await svc.rpc("restore_restaurant", {
    p_restaurant_id: restaurantId,
  });

  if (error) return { error: error.message };

  await logAudit(adminUser.id, "restore_restaurant", "restaurant", restaurantId, {});

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants/deleted");
  return { error: null };
}

// ── Domain management (admin) ─────────────────────────────────

export async function manageDomain(
  domainId: string,
  restaurantId: string,
  newStatus: "active" | "pending_verification" | "disconnected",
): Promise<AdminResult> {
  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("manage_restaurant_domain", {
    p_domain_id:  domainId,
    p_new_status: newStatus,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}

// ── Set/reset owner password ──────────────────────────────────
// Sets a new password for the user via Auth Admin.
// NEVER logs, returns, or persists the password itself.
export async function setOwnerPassword(
  userId: string,
  password: string,
): Promise<AdminResult> {
  if (!userId) return { error: "userId requerido." };
  if (!password || password.length < 8)
    return { error: "La contraseña debe tener al menos 8 caracteres." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();
  const { data: userData, error: lookupErr } = await svc.auth.admin.getUserById(userId);
  if (lookupErr || !userData.user) return { error: "Usuario no encontrado." };

  const { error } = await svc.auth.admin.updateUserById(userId, { password });
  if (error) return { error: `Error al actualizar contraseña: ${error.message}` };

  await logAudit(adminUser.id, "set_owner_password", "member", userId, {
    email: userData.user.email,
    note: "Contraseña establecida por platform_admin. Valor no registrado.",
  });

  revalidatePath("/admin");
  return { error: null, data: { email: userData.user.email } };
}

// ── Generate password reset link ──────────────────────────────
// Generates a one-time Supabase recovery link for the user.
// The link redirects to /auth/callback?next=/panel.
export async function generatePasswordResetLink(
  email: string,
): Promise<{ error: string | null; link?: string }> {
  if (!email) return { error: "Email requerido." };

  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const platformHost = process.env.NEXT_PUBLIC_PLATFORM_HOST;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (platformHost ? `https://${platformHost}` : "http://localhost:3000");

  const svc = adminServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/panel` },
  });

  if (error) return { error: `Error generando enlace: ${error.message}` };
  return { error: null, link: data.properties?.action_link };
}

// ── Check owner email ─────────────────────────────────────────
// Looks up a user by email via Auth Admin API.
// Used by the wizard to show the correct UI before creating a restaurant.
export async function checkOwnerEmail(
  email: string,
): Promise<{ error: string | null; exists: boolean; userId?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { error: "Dirección de correo inválida.", exists: false };
  }

  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message, exists: false };
  }

  const svc = adminServiceClient();
  const { data: userList, error: listErr } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return { error: `Error al buscar usuario: ${listErr.message}`, exists: false };

  const existing = userList?.users.find(
    (u) => u.email?.toLowerCase() === trimmed,
  );

  if (existing) {
    return { error: null, exists: true, userId: existing.id };
  }
  return { error: null, exists: false };
}

// ── Create restaurant (full) ──────────────────────────────────
// Creates restaurant + config + optional owner + optional plan.
// Never fails because of partial owner/plan errors — those go to pendingItems.
export type RestaurantCreationResult = {
  error: string | null;
  restaurantId?: string;
  restaurantName?: string;
  slug?: string;
  loginUrl?: string;
  owner?: {
    email: string;
    method: "created" | "linked";
    membershipCreated: boolean;
  };
  pendingItems?: string[];
};

export async function createRestaurantFull(
  formData: FormData,
): Promise<RestaurantCreationResult> {
  const name         = String(formData.get("name") ?? "").trim();
  const slug         = String(formData.get("slug") ?? "").trim().toLowerCase();
  const currency     = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const timezone     = String(formData.get("timezone") ?? "America/Caracas").trim();
  const businessType = String(formData.get("business_type") ?? "restaurant").trim();
  const ordersEnabled = formData.get("orders_enabled") !== "false";
  const whatsapp     = String(formData.get("whatsapp") ?? "").trim() || null;
  const instagram    = String(formData.get("instagram_url") ?? "").trim() || null;
  const description  = String(formData.get("description") ?? "").trim() || null;
  const ownerEmail   = String(formData.get("owner_email") ?? "").trim() || null;
  const ownerPassword = String(formData.get("owner_password") ?? "").trim() || null;
  const planId       = String(formData.get("plan_id") ?? "").trim() || null;

  if (!name || name.length < 2)
    return { error: "El nombre debe tener al menos 2 caracteres." };
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug))
    return { error: "El slug solo puede tener minúsculas, dígitos y guiones (3–63 chars)." };
  if (currency.length !== 3)
    return { error: "La moneda debe tener exactamente 3 letras." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const svc = adminServiceClient();

  // Check slug uniqueness before creating
  const { data: slugCheck } = await svc
    .from("restaurants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (slugCheck) return { error: "Este slug ya está en uso." };

  // 1. Create restaurant
  const { data: restaurant, error: rErr } = await supabase.from("restaurants").insert({
    name, slug, currency, timezone, status: "onboarding", business_type: businessType,
  }).select("id, name, slug").single();
  if (rErr) {
    if (rErr.code === "23505") return { error: "Este slug ya está en uso." };
    return { error: rErr.message };
  }

  const restaurantId = restaurant.id;
  const pendingItems: string[] = [];

  // 2. Create initial config
  await supabase.from("restaurant_config").upsert({
    restaurant_id: restaurantId,
    orders_enabled: ordersEnabled,
    whatsapp: whatsapp ?? undefined,
    instagram_url: instagram ?? undefined,
    description: description ?? undefined,
  }, { onConflict: "restaurant_id" });

  // 3. Optionally handle owner — partial failure is non-fatal
  let ownerResult: RestaurantCreationResult["owner"] | undefined;
  if (ownerEmail) {
    const ownerRes = await assignOwner(restaurantId, ownerEmail, ownerPassword ?? undefined);
    if (ownerRes.error) {
      pendingItems.push(
        `No se pudo crear el acceso para ${ownerEmail}: ${ownerRes.error}. Ve al detalle del negocio para asignar el propietario manualmente.`,
      );
    } else {
      const method = (ownerRes.data as Record<string, string> | undefined)?.method;
      ownerResult = {
        email: ownerEmail,
        method: method === "existing_user" ? "linked" : "created",
        membershipCreated: true,
      };
    }
  }

  // 4. Create subscription — default to "inicio" (US$0) if no plan selected.
  //    New businesses always get a plan to avoid accidental onboarding-libre access.
  let resolvedPlanId = planId;
  if (!resolvedPlanId) {
    const { data: inicioPlan } = await svc
      .from("plans")
      .select("id")
      .eq("plan_code", "inicio")
      .eq("is_active", true)
      .maybeSingle();
    resolvedPlanId = inicioPlan?.id ?? null;
  }

  if (resolvedPlanId) {
    const { error: subErr } = await supabase.from("subscriptions").insert({
      restaurant_id: restaurantId,
      plan_id: resolvedPlanId,
      status: "active",
      starts_at: new Date().toISOString(),
      created_by: adminUser.id,
    });
    if (subErr) {
      pendingItems.push(
        `No se pudo asignar el plan: ${subErr.message}. Ve al detalle del negocio para asignarlo manualmente.`,
      );
    }
  }

  // 5. Build loginUrl server-side
  const subdomainBase = process.env.PLATFORM_SUBDOMAIN_BASE;
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_PLATFORM_HOST
      ? `https://${process.env.NEXT_PUBLIC_PLATFORM_HOST}`
      : null);

  let loginUrl: string;
  if (subdomainBase) {
    loginUrl = `https://${slug}.${subdomainBase}/panel/login`;
  } else if (rawSiteUrl) {
    loginUrl = `${rawSiteUrl}/login?negocio=${slug}`;
  } else {
    loginUrl = `/login?negocio=${slug}`;
  }

  // 6. Audit log
  await logAudit(adminUser.id, "create_restaurant_full", "restaurant", restaurantId, {
    name, slug, currency, timezone,
    owner_email: ownerEmail ?? null,
    plan_id: planId ?? null,
    pending_items: pendingItems,
    note: ownerPassword ? "Password set by platform_admin. Value not logged." : undefined,
  });

  revalidatePath("/admin");
  return {
    error: null,
    restaurantId,
    restaurantName: name,
    slug,
    loginUrl,
    owner: ownerResult,
    pendingItems: pendingItems.length > 0 ? pendingItems : undefined,
  };
}

// ── Create restaurant with config ────────────────────────────
// Extended version of createRestaurant that also saves initial config.
export async function createRestaurantWithConfig(
  formData: FormData,
): Promise<AdminResult> {
  const name         = String(formData.get("name") ?? "").trim();
  const slug         = String(formData.get("slug") ?? "").trim().toLowerCase();
  const currency     = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const timezone     = String(formData.get("timezone") ?? "America/Caracas").trim();
  const businessType = String(formData.get("business_type") ?? "restaurant").trim();
  const ordersEnabled = formData.get("orders_enabled") !== "false";
  const whatsapp     = String(formData.get("whatsapp") ?? "").trim() || null;
  const instagram    = String(formData.get("instagram_url") ?? "").trim() || null;
  const description  = String(formData.get("description") ?? "").trim() || null;
  const ownerEmail   = String(formData.get("owner_email") ?? "").trim() || null;
  const ownerPassword = String(formData.get("owner_password") ?? "").trim() || null;
  const planId       = String(formData.get("plan_id") ?? "").trim() || null;

  if (!name || name.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    return { error: "El slug solo puede tener minúsculas, dígitos y guiones (3–63 chars)." };
  }
  if (currency.length !== 3) return { error: "La moneda debe tener exactamente 3 letras." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createServerClient();
  const svc = adminServiceClient();

  // 1. Create restaurant
  const { data: restaurant, error: rErr } = await supabase.from("restaurants").insert({
    name, slug, currency, timezone, status: "onboarding", business_type: businessType,
  }).select("id, name, slug").single();
  if (rErr) {
    if (rErr.code === "23505") return { error: "Este slug ya está en uso." };
    return { error: rErr.message };
  }

  // 2. Create initial config
  await supabase.from("restaurant_config").upsert({
    restaurant_id: restaurant.id,
    orders_enabled: ordersEnabled,
    whatsapp: whatsapp ?? undefined,
    instagram_url: instagram ?? undefined,
    description: description ?? undefined,
  }, { onConflict: "restaurant_id" });

  const details: Record<string, unknown> = { name, slug, currency, timezone };

  // 3. Optionally handle owner
  let ownerId: string | null = null;
  if (ownerEmail) {
    const ownerRes = await assignOwner(restaurant.id, ownerEmail, ownerPassword ?? undefined);
    if (ownerRes.error) {
      details.owner_warning = ownerRes.error;
    } else {
      ownerId = (ownerRes.data as Record<string, unknown> | undefined)?.userId as string ?? null;
      details.owner_email = ownerEmail;
    }
  }

  // 4. Create subscription — default to "inicio" (US$0) if no plan selected
  let resolvedPlanIdCfg = planId;
  if (!resolvedPlanIdCfg) {
    const { data: inicioPlan } = await svc
      .from("plans")
      .select("id")
      .eq("plan_code", "inicio")
      .eq("is_active", true)
      .maybeSingle();
    resolvedPlanIdCfg = inicioPlan?.id ?? null;
  }

  if (resolvedPlanIdCfg) {
    await supabase.from("subscriptions").insert({
      restaurant_id: restaurant.id,
      plan_id: resolvedPlanIdCfg,
      status: "active",
      starts_at: new Date().toISOString(),
    });
    details.plan_id = resolvedPlanIdCfg;
  }

  await logAudit(adminUser.id, "create_restaurant", "restaurant", restaurant.id, details);
  revalidatePath("/admin");
  return { error: null, data: { ...restaurant, ownerId, warning: details.owner_warning ?? null } };
}
// ── List platform users ───────────────────────────────────────
// Returns all auth users joined with their memberships.
// Filtering is performed client-side (small user counts during pilot).
export async function listPlatformUsers(opts?: {
  q?: string;
  restaurantId?: string;
  role?: string;
  memberStatus?: string;
}): Promise<{
  error: string | null;
  users?: Array<{
    userId: string;
    email: string;
    createdAt: string;
    firstName: string | null;
    lastName: string | null;
    memberships: Array<{
      membershipId: string;
      restaurantId: string;
      restaurantName: string;
      restaurantSlug: string;
      role: string;
      status: string;
    }>;
  }>;
}> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  // Fetch all auth users (paginate up to 10 000)
  const allAuthUsers: Array<{ id: string; email?: string; created_at: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { error: `Error al listar usuarios: ${error.message}` };
    allAuthUsers.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < 1000) break;
    page++;
  }

  // Fetch all memberships joined with restaurants
  const { data: memberships, error: memErr } = await svc
    .from("restaurant_members")
    .select("id, restaurant_id, user_id, role, status, restaurants(id, name, slug)")
    .order("created_at");
  if (memErr) return { error: `Error al listar membresías: ${memErr.message}` };

  // Fetch all user profiles (nullable name data)
  const { data: profiles } = await svc
    .from("user_profiles")
    .select("user_id, first_name, last_name");
  const profileMap = new Map<string, { firstName: string | null; lastName: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { firstName: p.first_name ?? null, lastName: p.last_name ?? null });
  }

  // Build a map: userId → memberships
  const memberMap = new Map<
    string,
    Array<{
      membershipId: string;
      restaurantId: string;
      restaurantName: string;
      restaurantSlug: string;
      role: string;
      status: string;
    }>
  >();
  for (const m of memberships ?? []) {
    const rest = m.restaurants as unknown as { id: string; name: string; slug: string } | null;
    if (!memberMap.has(m.user_id)) memberMap.set(m.user_id, []);
    memberMap.get(m.user_id)!.push({
      membershipId: m.id,
      restaurantId: m.restaurant_id,
      restaurantName: rest?.name ?? "(eliminado)",
      restaurantSlug: rest?.slug ?? "",
      role: m.role,
      status: m.status,
    });
  }

  let users = allAuthUsers.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      userId:    u.id,
      email:     u.email ?? "(sin correo)",
      createdAt: u.created_at,
      firstName: profile?.firstName ?? null,
      lastName:  profile?.lastName  ?? null,
      memberships: memberMap.get(u.id) ?? [],
    };
  });

  // Apply optional filters
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    users = users.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      (u.firstName ?? "").toLowerCase().includes(q) ||
      (u.lastName  ?? "").toLowerCase().includes(q),
    );
  }
  if (opts?.restaurantId) {
    users = users.filter((u) =>
      u.memberships.some((m) => m.restaurantId === opts.restaurantId),
    );
  }
  if (opts?.role) {
    users = users.filter((u) =>
      u.memberships.some((m) => m.role === opts.role),
    );
  }
  if (opts?.memberStatus) {
    users = users.filter((u) =>
      u.memberships.some((m) => m.status === opts.memberStatus),
    );
  }

  return { error: null, users };
}

// ── Create user membership ────────────────────────────────────
export async function createUserMembership(params: {
  email: string;
  restaurantId: string;
  role: "owner" | "attention" | "kitchen";
  password?: string;
}): Promise<{
  error: string | null;
  method?: "created" | "linked";
  userId?: string;
  loginUrl?: string;
  alreadyMember?: boolean;
  existingRole?: string;
  membershipId?: string;
}> {
  const { restaurantId, role, password } = params;
  const email = params.email.trim().toLowerCase();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Dirección de correo inválida." };
  }
  if (!["owner", "attention", "kitchen"].includes(role)) {
    return { error: "Rol inválido. Use owner, attention o kitchen." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  // Verify restaurant exists and is not deleted
  const { data: restaurant } = await svc
    .from("restaurants")
    .select("id, name, slug")
    .eq("id", restaurantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!restaurant) return { error: "Negocio no encontrado o eliminado." };

  // Build login URL the same way as createRestaurantFull
  const subdomainBase = process.env.PLATFORM_SUBDOMAIN_BASE;
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_PLATFORM_HOST
      ? `https://${process.env.NEXT_PUBLIC_PLATFORM_HOST}`
      : null);
  let loginUrl: string;
  if (subdomainBase) {
    loginUrl = `https://${restaurant.slug}.${subdomainBase}/panel/login`;
  } else if (rawSiteUrl) {
    loginUrl = `${rawSiteUrl}/login?negocio=${restaurant.slug}`;
  } else {
    loginUrl = `/login?negocio=${restaurant.slug}`;
  }

  // Check if user already exists in auth
  const emailCheck = await checkOwnerEmail(email);
  if (emailCheck.error) return { error: emailCheck.error };

  if (emailCheck.exists && emailCheck.userId) {
    const existingUserId = emailCheck.userId;

    // Check if already a member of this restaurant
    const { data: existingMember } = await svc
      .from("restaurant_members")
      .select("id, role, status")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", existingUserId)
      .maybeSingle();

    if (existingMember) {
      return {
        error: null,
        alreadyMember: true,
        existingRole: existingMember.role,
        membershipId: existingMember.id,
        userId: existingUserId,
      };
    }

    // Link existing user to restaurant
    const { data: newMem, error: insertErr } = await svc
      .from("restaurant_members")
      .insert({
        restaurant_id: restaurantId,
        user_id: existingUserId,
        role,
        status: "active",
      })
      .select("id")
      .single();
    if (insertErr) return { error: insertErr.message };

    await logAudit(adminUser.id, "create_user_membership", "member", newMem.id, {
      email, restaurant_id: restaurantId, role, method: "linked",
    });

    revalidatePath("/admin/usuarios");
    return { error: null, method: "linked", userId: existingUserId, loginUrl, membershipId: newMem.id };
  }

  // User does not exist — create new account
  if (!password || password.length < 8) {
    return { error: "Se requiere una contraseña de al menos 8 caracteres para cuentas nuevas." };
  }

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return { error: `Error al crear usuario: ${createErr.message}` };
  const newUserId = created.user.id;

  const { data: newMem, error: insertErr } = await svc
    .from("restaurant_members")
    .insert({
      restaurant_id: restaurantId,
      user_id: newUserId,
      role,
      status: "active",
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  await logAudit(adminUser.id, "create_user_membership", "member", newMem.id, {
    email, restaurant_id: restaurantId, role, method: "created",
    note: "Password set by platform_admin. Value not logged.",
  });

  revalidatePath("/admin/usuarios");
  return { error: null, method: "created", userId: newUserId, loginUrl, membershipId: newMem.id };
}

// ── Update membership role ────────────────────────────────────
export async function updateMembershipRole(
  membershipId: string,
  newRole: "owner" | "attention" | "kitchen",
): Promise<{ error: string | null }> {
  if (!["owner", "attention", "kitchen"].includes(newRole)) {
    return { error: "Rol inválido." };
  }

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  // Verify membership exists and restaurant is not deleted
  const { data: membership } = await svc
    .from("restaurant_members")
    .select("id, role, restaurant_id, restaurants(deleted_at)")
    .eq("id", membershipId)
    .maybeSingle();
  if (!membership) return { error: "Membresía no encontrada." };
  const rest = membership.restaurants as unknown as { deleted_at: string | null } | null;
  if (rest?.deleted_at) return { error: "El negocio ha sido eliminado." };

  const { error } = await svc
    .from("restaurant_members")
    .update({ role: newRole })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await logAudit(adminUser.id, "update_membership_role", "member", membershipId, {
    old_role: membership.role, new_role: newRole, restaurant_id: membership.restaurant_id,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

// ── Revoke membership ─────────────────────────────────────────
// Sets status=suspended. Blocks if this would remove the last active owner.
export async function revokeMembership(
  membershipId: string,
): Promise<{ error: string | null; lastOwnerBlocked?: boolean }> {
  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  // Fetch the membership
  const { data: membership } = await svc
    .from("restaurant_members")
    .select("id, role, status, restaurant_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!membership) return { error: "Membresía no encontrada." };

  // Last-owner guard: if this member is an owner, verify there is at least one other active owner
  if (membership.role === "owner") {
    const { count, error: countErr } = await svc
      .from("restaurant_members")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", membership.restaurant_id)
      .eq("role", "owner")
      .eq("status", "active");
    if (countErr) return { error: countErr.message };
    if ((count ?? 0) <= 1) {
      return { error: null, lastOwnerBlocked: true };
    }
  }

  const { error } = await svc
    .from("restaurant_members")
    .update({ status: "suspended" })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await logAudit(adminUser.id, "revoke_membership", "member", membershipId, {
    restaurant_id: membership.restaurant_id, role: membership.role,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

// ── Upsert user profile ───────────────────────────────────────
// Sets first_name / last_name in user_profiles.
// NEVER stores permissions here — only display-name data.
export async function upsertUserProfile(
  userId: string,
  firstName: string | null,
  lastName: string | null,
): Promise<AdminResult> {
  if (!userId) return { error: "userId requerido." };

  const trimFirst = firstName?.trim() || null;
  const trimLast  = lastName?.trim()  || null;

  if (trimFirst && trimFirst.length > 100)
    return { error: "El nombre no puede superar los 100 caracteres." };
  if (trimLast && trimLast.length > 100)
    return { error: "El apellido no puede superar los 100 caracteres." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  const { data: authData, error: authErr } = await svc.auth.admin.getUserById(userId);
  if (authErr || !authData.user) return { error: "Usuario no encontrado." };

  const { error } = await svc.from("user_profiles").upsert(
    { user_id: userId, first_name: trimFirst, last_name: trimLast, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) return { error: `Error al guardar perfil: ${error.message}` };

  await logAudit(adminUser.id, "upsert_user_profile", "member", userId, {
    email: authData.user.email, first_name: trimFirst, last_name: trimLast,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

// ── Add membership by user ID ─────────────────────────────────
// Creates or reactivates a membership for an existing user.
// 1. No membership → INSERT new.
// 2. Suspended membership → UPDATE to active + new role (reactivation).
// 3. Active/invited membership → returns alreadyActive without creating duplicate.
// NEVER grants platform_admin.
export async function addMembershipById(
  userId: string,
  restaurantId: string,
  role: "owner" | "attention" | "kitchen",
): Promise<AdminResult & { reactivated?: boolean; alreadyActive?: boolean; existingRole?: string; membershipId?: string }> {
  if (!userId)       return { error: "userId requerido." };
  if (!restaurantId) return { error: "restaurantId requerido." };
  if (!["owner", "attention", "kitchen"].includes(role))
    return { error: "Rol inválido." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  const { data: authData, error: authErr } = await svc.auth.admin.getUserById(userId);
  if (authErr || !authData.user) return { error: "Usuario no encontrado." };

  const { data: restaurant } = await svc
    .from("restaurants").select("id, name").eq("id", restaurantId).is("deleted_at", null).maybeSingle();
  if (!restaurant) return { error: "Negocio no encontrado o eliminado." };

  const { data: existing } = await svc
    .from("restaurant_members")
    .select("id, role, status")
    .eq("user_id", userId).eq("restaurant_id", restaurantId).maybeSingle();

  if (existing) {
    if (existing.status !== "suspended") {
      return { error: null, alreadyActive: true, existingRole: existing.role, membershipId: existing.id };
    }
    const { error } = await svc.from("restaurant_members")
      .update({ status: "active", role }).eq("id", existing.id);
    if (error) return { error: `Error al reactivar: ${error.message}` };

    await logAudit(adminUser.id, "reactivate_membership", "member", existing.id, {
      user_id: userId, email: authData.user.email,
      restaurant_id: restaurantId, restaurant_name: restaurant.name, new_role: role,
    });
    revalidatePath("/admin/usuarios");
    return { error: null, reactivated: true, membershipId: existing.id };
  }

  const { data: newMem, error: insertErr } = await svc
    .from("restaurant_members")
    .insert({ restaurant_id: restaurantId, user_id: userId, role, status: "active" })
    .select("id").single();
  if (insertErr) return { error: insertErr.message };

  await logAudit(adminUser.id, "add_membership_by_id", "member", newMem.id, {
    user_id: userId, email: authData.user.email,
    restaurant_id: restaurantId, restaurant_name: restaurant.name, role,
  });
  revalidatePath("/admin/usuarios");
  return { error: null, reactivated: false, membershipId: newMem.id };
}

// ── Reactivate membership ─────────────────────────────────────
// Restores a suspended membership to active, optionally changing the role.
export async function reactivateMembership(
  membershipId: string,
  newRole?: "owner" | "attention" | "kitchen",
): Promise<AdminResult> {
  if (!membershipId) return { error: "membershipId requerido." };
  if (newRole && !["owner", "attention", "kitchen"].includes(newRole))
    return { error: "Rol inválido." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  const { data: membership } = await svc
    .from("restaurant_members").select("id, role, status, restaurant_id")
    .eq("id", membershipId).maybeSingle();
  if (!membership) return { error: "Membresía no encontrada." };
  if (membership.status !== "suspended")
    return { error: "Solo se pueden reactivar membresías suspendidas." };

  const role = newRole ?? membership.role;
  const { error } = await svc.from("restaurant_members")
    .update({ status: "active", role }).eq("id", membershipId);
  if (error) return { error: error.message };

  await logAudit(adminUser.id, "reactivate_membership", "member", membershipId, {
    restaurant_id: membership.restaurant_id, role,
  });
  revalidatePath("/admin/usuarios");
  return { error: null };
}

// ── Delete user ───────────────────────────────────────────────
// Removes the Auth user (cascades restaurant_members, platform_admins,
// user_profiles). Guards:
//   · Cannot delete own account.
//   · Cannot delete the last platform_admin.
//   · Cannot delete while user is sole active owner of a live restaurant.
// Never deletes the user's businesses; only their account and memberships.
export async function deleteUser(
  userId: string,
): Promise<AdminResult & { soleOwnerOf?: string[]; isLastAdmin?: boolean }> {
  if (!userId) return { error: "userId requerido." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (userId === adminUser.id)
    return { error: "No puedes eliminar tu propia cuenta." };

  const svc = adminServiceClient();

  // Check if target is a platform_admin
  const { data: targetAdminRow } = await svc
    .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();

  if (targetAdminRow) {
    const { count: adminCount } = await svc
      .from("platform_admins").select("*", { count: "exact", head: true });
    if ((adminCount ?? 0) <= 1) {
      return {
        error: "No es posible eliminar al único administrador activo de la plataforma.",
        isLastAdmin: true,
      };
    }
  }

  // Check sole active ownership of non-deleted restaurants
  const { data: ownerships } = await svc
    .from("restaurant_members")
    .select("restaurant_id, restaurants!inner(id, name, deleted_at)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");

  const soleOwnerOf: string[] = [];
  for (const o of ownerships ?? []) {
    const rest = o.restaurants as unknown as { id: string; name: string; deleted_at: string | null } | null;
    if (!rest || rest.deleted_at) continue;
    const { count: ownerCount } = await svc
      .from("restaurant_members")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", o.restaurant_id)
      .eq("role", "owner")
      .eq("status", "active");
    if ((ownerCount ?? 0) <= 1) soleOwnerOf.push(rest.name);
  }

  if (soleOwnerOf.length > 0) {
    return { error: null, soleOwnerOf };
  }

  // Get info for audit before deletion
  const { data: authData } = await svc.auth.admin.getUserById(userId);
  const userEmail = authData?.user?.email ?? "(desconocido)";

  const { error: delErr } = await svc.auth.admin.deleteUser(userId);
  if (delErr) return { error: `Error al eliminar: ${delErr.message}` };

  await logAudit(adminUser.id, "delete_user", "member", userId, {
    email: userEmail,
    was_platform_admin: !!targetAdminRow,
    note: "Cuenta eliminada. Membresías y perfil eliminados por cascade.",
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

// ── Archive plan ──────────────────────────────────────────────
// Sets is_active = false. The plan stays in the DB for subscription history.
export async function archivePlan(planId: string): Promise<AdminResult> {
  if (!planId) return { error: "planId requerido." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();
  const { data: plan } = await svc.from("plans").select("id, name, is_active").eq("id", planId).maybeSingle();
  if (!plan) return { error: "Plan no encontrado." };
  if (!plan.is_active) return { error: "El plan ya está archivado." };

  const { error } = await svc.from("plans").update({ is_active: false }).eq("id", planId);
  if (error) return { error: error.message };

  await logAudit(adminUser.id, "archive_plan", "plan", planId, { name: plan.name });
  revalidatePath("/admin/planes");
  return { error: null };
}

// ── Delete plan ───────────────────────────────────────────────
// Hard-deletes a plan ONLY when no subscriptions reference it.
// If subscriptions exist, the caller should use archivePlan instead.
export async function deletePlan(planId: string): Promise<AdminResult> {
  if (!planId) return { error: "planId requerido." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();
  const { data: plan } = await svc.from("plans").select("id, name").eq("id", planId).maybeSingle();
  if (!plan) return { error: "Plan no encontrado." };

  const { count: subCount } = await svc
    .from("subscriptions").select("*", { count: "exact", head: true }).eq("plan_id", planId);
  if ((subCount ?? 0) > 0) {
    return {
      error: `Este plan tiene ${subCount} suscripción(es) asociada(s). Archívalo para conservar el historial.`,
    };
  }

  const { error } = await svc.from("plans").delete().eq("id", planId);
  if (error) return { error: error.message };

  await logAudit(adminUser.id, "delete_plan", "plan", planId, { name: plan.name });
  revalidatePath("/admin/planes");
  return { error: null };
}

// ── Hard delete restaurant ────────────────────────────────────
// Permanently removes a restaurant and ALL its data (cascade).
// Only allowed when: no subscriptions, no orders, no subscription_payments.
// Cleans Storage files for the restaurant.
// If financial data exists, callers should use softDeleteRestaurant instead.
export async function hardDeleteRestaurant(
  restaurantId: string,
  confirmedSlug: string,
): Promise<AdminResult> {
  if (!restaurantId) return { error: "restaurantId requerido." };
  if (!confirmedSlug?.trim()) return { error: "Se requiere el slug para confirmar." };

  let adminUser: { id: string } | null = null;
  try {
    const { user } = await requireAdmin();
    adminUser = user;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const svc = adminServiceClient();

  const { data: restaurant } = await svc
    .from("restaurants").select("id, name, slug").eq("id", restaurantId).maybeSingle();
  if (!restaurant) return { error: "Negocio no encontrado." };
  if (restaurant.slug !== confirmedSlug.trim())
    return { error: "El slug no coincide. Escríbelo exactamente." };

  // Guard: financial or order history → cannot hard-delete
  const [
    { count: subCount },
    { count: orderCount },
    { count: paymentCount },
  ] = await Promise.all([
    svc.from("subscriptions").select("*", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    svc.from("orders").select("*", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    svc.from("subscription_payments").select("*", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
  ]);

  if ((subCount ?? 0) > 0 || (orderCount ?? 0) > 0 || (paymentCount ?? 0) > 0) {
    return {
      error: `Este negocio tiene datos financieros o historial de pedidos (${subCount} suscripciones, ${orderCount} pedidos, ${paymentCount} pagos). Usa el archivo en lugar de la eliminación definitiva.`,
    };
  }

  // Collect Storage paths before deletion
  const { data: images } = await svc
    .from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("restaurant_id", restaurantId);

  // Delete catalog images from product-images bucket
  const imagePaths = (images ?? []).flatMap((img) => [
    img.storage_path,
    img.thumbnail_path,
    img.original_path,
  ].filter(Boolean) as string[]);

  if (imagePaths.length > 0) {
    await svc.storage.from("product-images").remove(imagePaths);
  }

  // Delete restaurant assets (logo, cover) from restaurant-assets bucket
  // Assets follow pattern: {restaurantId}/filename
  const { data: assetFiles } = await svc.storage
    .from("restaurant-assets")
    .list(restaurantId, { limit: 100 });

  if (assetFiles && assetFiles.length > 0) {
    const assetPaths = assetFiles.map((f) => `${restaurantId}/${f.name}`);
    await svc.storage.from("restaurant-assets").remove(assetPaths);
  }

  // Hard delete — CASCADE removes all related rows
  const { error } = await svc.from("restaurants").delete().eq("id", restaurantId);
  if (error) return { error: `Error al eliminar: ${error.message}` };

  await logAudit(adminUser.id, "hard_delete_restaurant", "restaurant", restaurantId, {
    name: restaurant.name,
    slug: restaurant.slug,
    images_deleted: imagePaths.length,
    note: "Eliminación definitiva. No tenía datos financieros ni pedidos.",
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { error: null };
}
