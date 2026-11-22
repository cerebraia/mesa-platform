"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import type {
  ProductInput,
  VariantInput,
  OptionGroupInput,
  ProductImage,
} from "@/lib/catalog-types";

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
  data: { name: string },
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const name = String(data.name ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

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
  data: { name: string; is_active?: boolean },
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const name     = String(data.name ?? "").trim();
  const isActive = data.is_active !== false;
  if (!name) return { error: "El nombre es obligatorio." };

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

  // Uses restore_product_admin RPC: same advisory lock + limit check as the owner path
  const { error } = await svc().rpc("restore_product_admin", {
    p_restaurant_id: restaurantId,
    p_product_id:    productId,
  });
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

// ── Admin product save ────────────────────────────────────────

export type AdminProductState = { error: string | null; productId?: string };

export async function adminSaveProduct(
  restaurantId: string,
  data: ProductInput & {
    variants: VariantInput[];
    option_groups: OptionGroupInput[];
    image_path?: string;
    thumb_path?: string;
    old_image_path?: string;
    old_image_id?: string;
    old_thumb_path?: string;
  },
): Promise<AdminProductState> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  if (data.id) {
    const { data: p } = await svc().from("products")
      .select("deleted_at").eq("id", data.id).eq("restaurant_id", restaurantId).maybeSingle();
    if (!p) return { error: "Producto no encontrado." };
    if (p.deleted_at) return { error: "No se puede editar un producto eliminado." };
  }

  const { data: productId, error: rpcError } = await svc().rpc("upsert_product_admin", {
    p_restaurant_id: restaurantId,
    p_product: {
      id: data.id ?? null,
      category_id: data.category_id,
      name: data.name,
      description: data.description ?? "",
      base_price_cents: data.base_price_cents,
      promo_price_cents: data.promo_price_cents ?? null,
      is_available: data.is_available ?? true,
      is_published: data.is_published ?? false,
      position: 0,
      image_fit: data.image_fit ?? "cover",
    },
    p_variants: data.variants,
    p_option_groups: data.option_groups,
  });

  if (rpcError) return { error: rpcError.message };
  const pid = productId as string;

  if (data.image_path) {
    if (data.old_image_id) {
      await svc().from("product_images").delete()
        .eq("id", data.old_image_id).eq("restaurant_id", restaurantId);
    }
    const { error: imgErr } = await svc().from("product_images").insert({
      product_id: pid, restaurant_id: restaurantId,
      storage_path: data.image_path, thumbnail_path: data.thumb_path ?? null, position: 0,
    });
    if (imgErr) {
      await svc().storage.from("product-images").remove([data.image_path]);
      if (data.thumb_path) await svc().storage.from("product-images").remove([data.thumb_path]);
      return { error: `Producto guardado pero error al asociar imagen: ${imgErr.message}`, productId: pid };
    }
    const toDelete: string[] = [];
    if (data.old_image_path) toDelete.push(data.old_image_path);
    if (data.old_thumb_path) toDelete.push(data.old_thumb_path);
    if (toDelete.length) await svc().storage.from("product-images").remove(toDelete);
  } else if (data.thumb_path) {
    await svc().from("product_images").update({ thumbnail_path: data.thumb_path })
      .eq("product_id", pid).eq("restaurant_id", restaurantId);
    if (data.old_thumb_path) await svc().storage.from("product-images").remove([data.old_thumb_path]);
  }

  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null, productId: pid };
}

export async function adminHardDeleteProduct(
  restaurantId: string,
  productId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data: p } = await svc().from("products").select("id")
    .eq("id", productId).eq("restaurant_id", restaurantId).not("deleted_at", "is", null).maybeSingle();
  if (!p) return { error: "Producto no encontrado en papelera." };

  const { data: images } = await svc().from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("product_id", productId).eq("restaurant_id", restaurantId);
  const paths = (images ?? []).flatMap((img) =>
    [img.storage_path, img.thumbnail_path, img.original_path].filter(Boolean) as string[],
  );
  if (paths.length) await svc().storage.from("product-images").remove(paths);

  const { error } = await svc().from("products").delete()
    .eq("id", productId).eq("restaurant_id", restaurantId).not("deleted_at", "is", null);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

// ── Category management ───────────────────────────────────────

export async function adminDeleteCategory(
  restaurantId: string,
  categoryId: string,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { count } = await svc().from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId).eq("restaurant_id", restaurantId);
  if ((count ?? 0) > 0) {
    return { error: `Esta categoría tiene ${count} producto${count === 1 ? "" : "s"} (incluidos eliminados). Usa "Trasladar y eliminar".` };
  }
  const { error } = await svc().from("categories").delete().eq("id", categoryId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  return { error: null };
}

export async function adminSetCategoryActive(
  restaurantId: string,
  categoryId: string,
  active: boolean,
): Promise<ManageResult> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  // Use direct UPDATE via service role (set_category_active RPC checks member_role, not valid for admin)
  const { error } = await svc().from("categories")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", categoryId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}

export async function adminTransferAndDeleteCategory(
  restaurantId: string,
  sourceCategoryId: string,
  targetCategoryId: string,
): Promise<ManageResult> {
  if (!targetCategoryId) return { error: "Debes elegir una categoría destino." };
  if (sourceCategoryId === targetCategoryId) return { error: "La categoría destino debe ser diferente." };
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const db = svc();
  const [{ data: src }, { data: tgt }] = await Promise.all([
    db.from("categories").select("id").eq("id", sourceCategoryId).eq("restaurant_id", restaurantId).maybeSingle(),
    db.from("categories").select("id").eq("id", targetCategoryId).eq("restaurant_id", restaurantId).maybeSingle(),
  ]);
  if (!src) return { error: "Categoría de origen no encontrada." };
  if (!tgt) return { error: "Categoría destino no encontrada." };

  const { error: moveErr } = await db.from("products")
    .update({ category_id: targetCategoryId }).eq("category_id", sourceCategoryId).eq("restaurant_id", restaurantId);
  if (moveErr) return { error: `Error al trasladar: ${moveErr.message}` };

  const { error: delErr } = await db.from("categories").delete().eq("id", sourceCategoryId).eq("restaurant_id", restaurantId);
  if (delErr) return { error: `Productos trasladados pero no se pudo eliminar la categoría: ${delErr.message}` };
  revalidateManage(restaurantId);
  return { error: null };
}

// ── Gallery image actions (admin) ─────────────────────────────

export async function adminAddProductImage(
  restaurantId: string,
  productId: string,
  storagePath: string,
  thumbPath: string | null,
): Promise<{ error: string | null; image?: ProductImage }> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data: prod } = await svc().from("products").select("id")
    .eq("id", productId).eq("restaurant_id", restaurantId).is("deleted_at", null).maybeSingle();
  if (!prod) return { error: "Producto no encontrado." };

  const { data: maxRow } = await svc().from("product_images").select("position")
    .eq("product_id", productId).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await svc().from("product_images")
    .insert({ product_id: productId, restaurant_id: restaurantId, storage_path: storagePath, thumbnail_path: thumbPath, position })
    .select("id, product_id, restaurant_id, storage_path, thumbnail_path, alt_text, position, created_at, original_path")
    .single();
  if (error) return { error: error.message };
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null, image: data as ProductImage };
}

export async function adminRemoveProductImage(
  restaurantId: string,
  imageId: string,
): Promise<{ error: string | null }> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data: img } = await svc().from("product_images")
    .select("storage_path, thumbnail_path").eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();
  const { error } = await svc().from("product_images").delete().eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  const toDelete: string[] = [];
  if (img?.storage_path)   toDelete.push(img.storage_path);
  if (img?.thumbnail_path) toDelete.push(img.thumbnail_path);
  if (toDelete.length) await svc().storage.from("product-images").remove(toDelete);
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}

export async function adminReorderProductImages(
  restaurantId: string,
  productId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  await Promise.all(
    orderedIds.map((id, position) =>
      svc().from("product_images").update({ position })
        .eq("id", id).eq("product_id", productId).eq("restaurant_id", restaurantId),
    ),
  );
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}

export async function adminUpdateProductImagePaths(
  restaurantId: string,
  imageId: string,
  newStoragePath: string | null,
  newThumbnailPath: string | null,
  preserveAsOriginal?: string | null,
): Promise<{ error: string | null }> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data: img } = await svc().from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!img) return { error: "Imagen no encontrada." };

  const protectedPath = img.original_path ?? preserveAsOriginal ?? null;
  const updates: Record<string, string | null | undefined> = {};
  if (newStoragePath)   updates.storage_path   = newStoragePath;
  if (newThumbnailPath) updates.thumbnail_path = newThumbnailPath;
  if (!img.original_path && preserveAsOriginal) updates.original_path = preserveAsOriginal;
  if (Object.keys(updates).length === 0) return { error: null };

  const { error } = await svc().from("product_images").update(updates)
    .eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  const toDelete: string[] = [];
  if (newStoragePath && img.storage_path && img.storage_path !== protectedPath) toDelete.push(img.storage_path);
  if (newThumbnailPath && img.thumbnail_path) toDelete.push(img.thumbnail_path);
  if (toDelete.length) await svc().storage.from("product-images").remove(toDelete);
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}

export async function adminRestoreOriginalImage(
  restaurantId: string,
  imageId: string,
): Promise<{ error: string | null }> {
  try { await requireAdminForRestaurant(restaurantId); }
  catch (e) { return { error: (e as Error).message }; }

  const { data: img } = await svc().from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!img) return { error: "Imagen no encontrada." };
  if (!img.original_path) return { error: "Esta imagen no tiene encuadre activo." };

  const { error } = await svc().from("product_images")
    .update({ storage_path: img.original_path, thumbnail_path: null, original_path: null })
    .eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  const toDelete: string[] = [];
  if (img.storage_path !== img.original_path) toDelete.push(img.storage_path);
  if (img.thumbnail_path) toDelete.push(img.thumbnail_path);
  if (toDelete.length) await svc().storage.from("product-images").remove(toDelete);
  revalidateManage(restaurantId);
  revalidatePath(`/r/[slug]`, "page");
  return { error: null };
}
