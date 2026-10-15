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
  const { data: adminRow } = await supabase.from("platform_admins").select("user_id").maybeSingle();
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
  const name     = String(formData.get("name") ?? "").trim();
  const slug     = String(formData.get("slug") ?? "").trim().toLowerCase();
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const timezone = String(formData.get("timezone") ?? "America/Caracas").trim();

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
  const { data: restaurant, error } = await supabase.from("restaurants").insert({
    name, slug, currency, timezone, status: "onboarding",
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
    return { error: null, data: { method: "existing_user", email: trimmedEmail } };
  }

  // User does not exist — create invited membership row first (no user_id yet)
  // We'll use Supabase invite to create the user and give them access.
  // The invite flow: user clicks link → sets password → logs in.
  // Validate redirect URL to our own domain only.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    // No site URL configured — can't send invite
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
