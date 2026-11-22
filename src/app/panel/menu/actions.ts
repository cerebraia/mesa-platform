"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembershipForAction } from "@/lib/panel-context";
import type {
  ProductInput,
  VariantInput,
  OptionGroupInput,
} from "@/lib/catalog-types";

// ── helpers ──────────────────────────────────────────────────

async function getOwnerRestaurant() {
  const supabase = await createServerClient();
  const { restaurantId } = await getActiveMembershipForAction({ requiredRole: "owner" });
  return { supabase, restaurantId };
}

// ── Category actions ─────────────────────────────────────────

export type CategoryState = { error: string | null };

export async function createCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Use position = current max + 1
  const { data: maxRow } = await supabase
    .from("categories")
    .select("position")
    .eq("restaurant_id", restaurantId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("categories").insert({
    restaurant_id: restaurantId,
    name,
    position,
  });

  if (error) return { error: `No se pudo crear la categoría: ${error.message}` };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  redirect("/panel/menu");
}

export async function updateCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  redirect("/panel/menu");
}

export async function setCategoryActive(
  categoryId: string,
  active: boolean,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase.rpc("set_category_active", {
    p_restaurant_id: restaurantId,
    p_category_id: categoryId,
    p_active: active,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

export async function deleteCategory(
  categoryId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Check if the category has products (including soft-deleted) to give a clear error
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("restaurant_id", restaurantId);

  if ((count ?? 0) > 0) {
    return {
      error: `Esta categoría tiene ${count} producto${count === 1 ? "" : "s"} (incluidos eliminados). Usa "Trasladar y eliminar" para moverlos a otra categoría primero.`,
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

// Moves all products (active and in trash) from sourceCategoryId to targetCategoryId,
// then deletes sourceCategoryId. Never deletes any product silently.
// Both categories must belong to the same restaurant.
export async function transferAndDeleteCategory(
  sourceCategoryId: string,
  targetCategoryId: string,
): Promise<{ error: string | null }> {
  if (!targetCategoryId) return { error: "Debes elegir una categoría destino." };
  if (sourceCategoryId === targetCategoryId) return { error: "La categoría destino debe ser diferente a la de origen." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Verify source category belongs to this restaurant
  const { data: srcCat } = await supabase
    .from("categories")
    .select("id")
    .eq("id", sourceCategoryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!srcCat) return { error: "Categoría de origen no encontrada." };

  // Verify target category belongs to this restaurant
  const { data: tgtCat } = await supabase
    .from("categories")
    .select("id")
    .eq("id", targetCategoryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!tgtCat) return { error: "Categoría destino no encontrada o no pertenece a este negocio." };

  // Move all products (including soft-deleted) from source to target
  const { error: moveErr } = await supabase
    .from("products")
    .update({ category_id: targetCategoryId })
    .eq("category_id", sourceCategoryId)
    .eq("restaurant_id", restaurantId);

  if (moveErr) return { error: `Error al trasladar productos: ${moveErr.message}` };

  // Source category is now empty; delete it
  const { error: delErr } = await supabase
    .from("categories")
    .delete()
    .eq("id", sourceCategoryId)
    .eq("restaurant_id", restaurantId);

  if (delErr) {
    // Products were already moved — the category is empty but delete failed.
    // Return specific error so user can retry the delete.
    return { error: `Productos trasladados, pero no se pudo eliminar la categoría vacía: ${delErr.message}` };
  }

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

// ── Product actions ──────────────────────────────────────────

export type ProductState = { error: string | null; productId?: string };

export async function saveProduct(
  data: ProductInput & {
    variants: VariantInput[];
    option_groups: OptionGroupInput[];
    image_path?: string;
    thumb_path?: string;       // cropped 1:1 thumbnail (migration 027)
    old_image_path?: string;
    old_image_id?: string;
    old_thumb_path?: string;
  },
): Promise<ProductState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Guard: editing a soft-deleted product is not allowed.
  if (data.id) {
    const { data: existing } = await supabase
      .from("products")
      .select("deleted_at")
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (existing?.deleted_at) return { error: "No se puede editar un producto eliminado." };
  }

  // Call the atomic RPC — runs product + variants + option_groups in one transaction.
  const { data: productId, error: rpcError } = await supabase.rpc(
    "upsert_product",
    {
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
        position: data.position ?? 0,
        image_fit: data.image_fit ?? "cover",
      },
      p_variants: data.variants,
      p_option_groups: data.option_groups,
    },
  );

  if (rpcError) return { error: rpcError.message };

  // Handle image update after product save succeeds.
  // "Keep old image until new reference is saved" pattern:
  // 1. Image was already uploaded to Storage by the API route.
  // 2. Here we create the product_image record.
  // 3. Only if successful do we delete the old image.
  if (data.image_path) {
    // If replacing, delete old record first (Storage file kept until new one confirmed).
    if (data.old_image_id) {
      await supabase
        .from("product_images")
        .delete()
        .eq("id", data.old_image_id)
        .eq("restaurant_id", restaurantId);
    }

    const { error: imgError } = await supabase.from("product_images").insert({
      product_id: productId as string,
      restaurant_id: restaurantId,
      storage_path: data.image_path,
      thumbnail_path: data.thumb_path ?? null,
      position: 0,
    });

    if (imgError) {
      await supabase.storage.from("product-images").remove([data.image_path]);
      if (data.thumb_path) await supabase.storage.from("product-images").remove([data.thumb_path]);
      return {
        error: `Producto guardado pero error al asociar imagen: ${imgError.message}`,
        productId: productId as string,
      };
    }

    // New image record saved — now safe to delete the old Storage files.
    const toDelete: string[] = [];
    if (data.old_image_path) toDelete.push(data.old_image_path);
    if (data.old_thumb_path) toDelete.push(data.old_thumb_path);
    if (toDelete.length) await supabase.storage.from("product-images").remove(toDelete);
  } else if (data.thumb_path) {
    // Only thumbnail updated (crop of existing image)
    await supabase.from("product_images").update({ thumbnail_path: data.thumb_path })
      .eq("product_id", productId as string)
      .eq("restaurant_id", restaurantId);
    if (data.old_thumb_path) {
      await supabase.storage.from("product-images").remove([data.old_thumb_path]);
    }
  }

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null, productId: productId as string };
}

// ── Soft-delete / restore ─────────────────────────────────────

export async function softDeleteProduct(
  productId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase.rpc("soft_delete_product", {
    p_restaurant_id: restaurantId,
    p_product_id: productId,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

export async function restoreProduct(
  productId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase.rpc("restore_product", {
    p_restaurant_id: restaurantId,
    p_product_id: productId,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel/menu");
  return { error: null };
}

// Permanently deletes a soft-deleted product and its Storage files.
// Only works on products with deleted_at IS NOT NULL.
// Variants, option_groups, options and product_images cascade-delete from the DB.
export async function hardDeleteProduct(
  productId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Verify product is soft-deleted and belongs to this restaurant
  const { data: product } = await supabase
    .from("products")
    .select("id, deleted_at")
    .eq("id", productId)
    .eq("restaurant_id", restaurantId)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (!product) {
    return { error: "Producto no encontrado o no está en la papelera." };
  }

  // Collect Storage paths before deleting
  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("product_id", productId)
    .eq("restaurant_id", restaurantId);

  // Delete Storage files first (failure is non-fatal — orphan files are harmless)
  const paths = (images ?? []).flatMap((img) =>
    [img.storage_path, img.thumbnail_path, img.original_path].filter(Boolean) as string[],
  );
  if (paths.length > 0) {
    await supabase.storage.from("product-images").remove(paths);
  }

  // Hard delete — CASCADE removes variants, option_groups, options, product_images
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("restaurant_id", restaurantId)
    .not("deleted_at", "is", null);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

export async function setProductPublished(
  productId: string,
  published: boolean,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Guard: soft-deleted products cannot be published/unpublished from this action.
  const { data: existing } = await supabase
    .from("products")
    .select("deleted_at")
    .eq("id", productId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (existing?.deleted_at) return { error: "No se puede publicar un producto eliminado." };

  const { error } = await supabase.rpc("set_product_published", {
    p_restaurant_id: restaurantId,
    p_product_id: productId,
    p_published: published,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null };
}

// ── Product image gallery actions ─────────────────────────────

import type { ProductImage } from "@/lib/catalog-types";

export async function addProductImage(
  productId: string,
  storagePath: string,
  thumbPath: string | null,
): Promise<{ error: string | null; image?: ProductImage }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: prod } = await supabase
    .from("products").select("id")
    .eq("id", productId).eq("restaurant_id", restaurantId).is("deleted_at", null).maybeSingle();
  if (!prod) return { error: "Producto no encontrado." };

  const { data: maxRow } = await supabase
    .from("product_images").select("position")
    .eq("product_id", productId).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, restaurant_id: restaurantId, storage_path: storagePath, thumbnail_path: thumbPath, position })
    .select("id, product_id, restaurant_id, storage_path, thumbnail_path, alt_text, position, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/panel/menu"); revalidatePath("/r/[slug]", "page");
  return { error: null, image: data as ProductImage };
}

export async function removeProductImage(
  imageId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: img } = await supabase
    .from("product_images").select("storage_path, thumbnail_path")
    .eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();

  const { error } = await supabase
    .from("product_images").delete().eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  const toDelete: string[] = [];
  if (img?.storage_path)   toDelete.push(img.storage_path);
  if (img?.thumbnail_path) toDelete.push(img.thumbnail_path);
  if (toDelete.length) await supabase.storage.from("product-images").remove(toDelete);

  revalidatePath("/panel/menu"); revalidatePath("/r/[slug]", "page");
  return { error: null };
}

export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("product_images").update({ position })
        .eq("id", id).eq("product_id", productId).eq("restaurant_id", restaurantId),
    ),
  );

  revalidatePath("/panel/menu"); revalidatePath("/r/[slug]", "page");
  return { error: null };
}

// Updates storage_path and/or thumbnail_path for an existing product image.
//
// Reversibility: when preserveAsOriginal is provided (the path of the first
// original upload), it is written to original_path and NEVER deleted by this
// action — even if it was previously stored in storage_path.  Subsequent calls
// keep the first original because we only write to original_path when it is NULL.
//
// Deletion policy:
//   • Old storage_path is deleted ONLY when it differs from the original path.
//   • Old thumbnail_path is always deleted (it is always a derived file).
export async function updateProductImagePaths(
  imageId: string,
  newStoragePath: string | null,
  newThumbnailPath: string | null,
  preserveAsOriginal?: string | null,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!img) return { error: "Imagen no encontrada." };

  // Determine the path to protect.  We only snapshot it on the FIRST frame;
  // subsequent re-frames keep whatever was recorded first.
  const protectedPath: string | null =
    img.original_path ?? preserveAsOriginal ?? null;

  const updates: {
    storage_path?: string;
    thumbnail_path?: string;
    original_path?: string;
  } = {};
  if (newStoragePath)   updates.storage_path   = newStoragePath;
  if (newThumbnailPath) updates.thumbnail_path = newThumbnailPath;
  // Write original_path only when this is the first frame operation.
  if (!img.original_path && preserveAsOriginal) {
    updates.original_path = preserveAsOriginal;
  }
  if (Object.keys(updates).length === 0) return { error: null };

  const { error } = await supabase
    .from("product_images").update(updates)
    .eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  // Delete old files — but NEVER delete the original.
  const toDelete: string[] = [];
  if (newStoragePath && img.storage_path && img.storage_path !== protectedPath) {
    toDelete.push(img.storage_path);
  }
  if (newThumbnailPath && img.thumbnail_path) {
    toDelete.push(img.thumbnail_path);
  }
  if (toDelete.length) await supabase.storage.from("product-images").remove(toDelete);

  revalidatePath("/panel/menu"); revalidatePath("/r/[slug]", "page");
  return { error: null };
}

// Restores a product image to its first original upload.
// Deletes the current display version and thumbnail, then clears original_path.
export async function restoreOriginalImage(
  imageId: string,
): Promise<{ error: string | null }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path, thumbnail_path, original_path")
    .eq("id", imageId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!img) return { error: "Imagen no encontrada." };
  if (!img.original_path) return { error: "Esta imagen no tiene encuadre activo." };

  // Restore: storage_path ← original_path, clear thumbnail and original_path.
  const { error } = await supabase
    .from("product_images")
    .update({ storage_path: img.original_path, thumbnail_path: null, original_path: null })
    .eq("id", imageId).eq("restaurant_id", restaurantId);
  if (error) return { error: error.message };

  // Delete the cleaned display version and thumbnail (originals are now storage_path).
  const toDelete: string[] = [];
  if (img.storage_path !== img.original_path) toDelete.push(img.storage_path);
  if (img.thumbnail_path)                     toDelete.push(img.thumbnail_path);
  if (toDelete.length) await supabase.storage.from("product-images").remove(toDelete);

  revalidatePath("/panel/menu"); revalidatePath("/r/[slug]", "page");
  return { error: null };
}
