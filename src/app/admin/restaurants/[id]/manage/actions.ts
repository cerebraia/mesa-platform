"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";

// ── Auth helpers ──────────────────────────────────────────────

function svc() {
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function requireAdminForRestaurant(restaurantId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: adminRow, error: adminErr } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminErr) throw new Error(`Error de autorización: ${adminErr.message}`);
  if (!adminRow) throw new Error("Acceso denegado: se requiere platform_admin.");

  // Verify target restaurant exists and is not deleted
  const { data: restaurant } = await svc()
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!restaurant) throw new Error("Negocio no encontrado o eliminado.");

  return { user, restaurantId };
}

export type ManageResult = { error: string | null; data?: unknown };

function revalidateManage(restaurantId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/manage`, "layout");
}

// ── Categories ────────────────────────────────────────────────

export async function adminCreateCategory(
  restaurantId: string,
  formData: FormData,
): Promise<ManageResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const db = svc();
  const { data: maxRow } = await db.from("categories")
    .select("position").eq("restaurant_id", restaurantId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { error } = await db.from("categories").insert({ restaurant_id: restaurantId, name, position });
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

export async function adminUpdateCategory(
  restaurantId: string,
  categoryId: string,
  formData: FormData,
): Promise<ManageResult> {
  const name     = String(formData.get("name") ?? "").trim();
  const isActive = formData.get("is_active") !== "false";
  if (!name) return { error: "El nombre es obligatorio." };
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { error } = await svc().from("categories")
    .update({ name, is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", categoryId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

// ── Products ──────────────────────────────────────────────────

export async function adminSetProductPublished(
  restaurantId: string,
  productId: string,
  published: boolean,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  // Refuse to publish a product without price
  if (published) {
    const { data: p } = await svc().from("products")
      .select("base_price_cents").eq("id", productId).eq("restaurant_id", restaurantId)
      .is("deleted_at", null).maybeSingle();
    if (!p) return { error: "Producto no encontrado." };
    if (p.base_price_cents == null) return { error: "No se puede publicar un producto sin precio." };
  }

  const { error } = await svc().from("products")
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq("id", productId).eq("restaurant_id", restaurantId).is("deleted_at", null);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

export async function adminSoftDeleteProduct(
  restaurantId: string,
  productId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { user } = await requireAdminForRestaurant(restaurantId);

  const { error } = await svc().from("products")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id, is_published: false,
              updated_at: new Date().toISOString() })
    .eq("id", productId).eq("restaurant_id", restaurantId).is("deleted_at", null);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

export async function adminRestoreProduct(
  restaurantId: string,
  productId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { error } = await svc().from("products")
    .update({ deleted_at: null, deleted_by: null, is_published: false,
              updated_at: new Date().toISOString() })
    .eq("id", productId).eq("restaurant_id", restaurantId).not("deleted_at", "is", null);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

// ── Configuration ─────────────────────────────────────────────

export async function adminSaveConfig(
  restaurantId: string,
  formData: FormData,
): Promise<ManageResult> {
  const name     = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!name)     return { error: "El nombre del negocio es obligatorio." };
  if (!timezone) return { error: "La zona horaria es obligatoria." };

  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const config = {
    description:           String(formData.get("description") ?? ""),
    primary_color:         String(formData.get("primary_color") ?? "").trim() || "#703BE6",
    background_color:      String(formData.get("background_color") ?? "").trim(),
    secondary_color:       String(formData.get("secondary_color") ?? "").trim(),
    font_family:           String(formData.get("font_family") ?? "").trim(),
    phone:                 String(formData.get("phone") ?? "").trim(),
    whatsapp:              String(formData.get("whatsapp") ?? "").trim(),
    instagram_url:         String(formData.get("instagram_url") ?? "").trim(),
    facebook_url:          String(formData.get("facebook_url") ?? "").trim(),
    twitter_url:           String(formData.get("twitter_url") ?? "").trim(),
    address:               String(formData.get("address") ?? "").trim(),
    pickup_enabled:        formData.get("pickup_enabled") === "true",
    pickup_address:        String(formData.get("pickup_address") ?? "").trim(),
    pickup_notes:          String(formData.get("pickup_notes") ?? "").trim(),
    delivery_enabled:      formData.get("delivery_enabled") === "true",
    is_temporarily_closed: formData.get("is_temporarily_closed") === "true",
    closed_message:        String(formData.get("closed_message") ?? "").trim(),
    orders_enabled:        formData.get("orders_enabled") === "true",
  };

  // Use service role to call the RPC (bypasses member_role check in the RPC)
  const db = svc();
  const { error } = await db.rpc("save_restaurant_config", {
    p_restaurant_id: restaurantId,
    p_name:          name,
    p_timezone:      timezone,
    p_config:        config,
  });
  if (error) return { error: error.message };

  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}

// ── Orders ────────────────────────────────────────────────────

export async function adminAdvanceOrderStatus(
  restaurantId: string,
  orderId: string,
  newStatus: string,
  expectedStatus: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data, error } = await svc().rpc("advance_order_status", {
    p_restaurant_id:  restaurantId,
    p_order_id:       orderId,
    p_new_status:     newStatus,
    p_expected_status: expectedStatus,
  });
  if (error) return { error: error.message };
  if (data && !data.success) {
    if (data.conflict) return { error: `Conflicto: el pedido ya cambió de estado (actual: ${data.current_status}).` };
    return { error: "No se pudo avanzar el estado del pedido." };
  }
  revalidatePath(`/admin/restaurants/${restaurantId}/manage/pedidos`);
  return { error: null };
}

// ── Financial movements ───────────────────────────────────────

export async function adminSaveMovement(
  restaurantId: string,
  formData: FormData,
): Promise<ManageResult> {
  const movementId = String(formData.get("id") ?? "").trim() || null;
  const type       = String(formData.get("type") ?? "").trim();
  const amountStr  = String(formData.get("amount") ?? "").trim();
  const concept    = String(formData.get("concept") ?? "").trim();
  const dateStr    = String(formData.get("movement_date") ?? "").trim();
  const category   = String(formData.get("category") ?? "").trim() || null;
  const notes      = String(formData.get("notes") ?? "").trim() || null;
  const reference  = String(formData.get("reference") ?? "").trim() || null;

  if (!["income", "expense", "purchase"].includes(type)) return { error: "Tipo inválido." };
  if (!concept) return { error: "El concepto es obligatorio." };
  if (!dateStr)  return { error: "La fecha es obligatoria." };

  const amountFloat = parseFloat(amountStr);
  if (isNaN(amountFloat) || amountFloat <= 0) return { error: "El monto debe ser positivo." };
  const amountCents = Math.round(amountFloat * 100);

  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const db = svc();
  const payload = {
    restaurant_id: restaurantId,
    type, concept, amount_cents: amountCents,
    movement_date: dateStr, category, notes, reference,
  };

  const { data: result, error } = movementId
    ? await db.from("financial_movements")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", movementId).eq("restaurant_id", restaurantId)
        .select("id").single()
    : await db.from("financial_movements").insert(payload).select("id").single();

  if (error) return { error: error.message };
  revalidatePath(`/admin/restaurants/${restaurantId}/manage/finanzas`);
  return { error: null, data: result };
}

export async function adminDeleteMovement(
  restaurantId: string,
  movementId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { error } = await svc().from("financial_movements")
    .delete().eq("id", movementId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/restaurants/${restaurantId}/manage/finanzas`);
  return { error: null };
}

// ── Members ───────────────────────────────────────────────────

export async function adminAddMember(
  restaurantId: string,
  email: string,
  role: string,
): Promise<ManageResult> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail))
    return { error: "Correo inválido." };
  if (!["owner", "attention", "kitchen"].includes(role))
    return { error: "Rol inválido." };
  if (role === "owner") return { error: "Usa la sección Propietario para asignar owners." };

  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const db = svc();
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targetUser = userList?.users.find((u) => u.email?.toLowerCase() === trimmedEmail);
  if (!targetUser) return { error: "No existe una cuenta con ese correo." };

  // Verify it's not a platform_admin (cannot become regular member)
  const { data: isAdmin } = await db.from("platform_admins")
    .select("user_id").eq("user_id", targetUser.id).maybeSingle();
  if (isAdmin) return { error: "Los administradores de plataforma no pueden ser miembros de negocio." };

  const { data: existing } = await db.from("restaurant_members")
    .select("id, role, status").eq("restaurant_id", restaurantId).eq("user_id", targetUser.id).maybeSingle();

  if (existing) {
    const { error } = await db.from("restaurant_members")
      .update({ role, status: "active" }).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("restaurant_members")
      .insert({ restaurant_id: restaurantId, user_id: targetUser.id, role, status: "active" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/restaurants/${restaurantId}/manage/miembros`);
  return { error: null };
}

export async function adminRemoveMember(
  restaurantId: string,
  memberId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { error } = await svc().from("restaurant_members")
    .delete().eq("id", memberId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/restaurants/${restaurantId}/manage/miembros`);
  return { error: null };
}
