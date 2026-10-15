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

// ── Product actions ──────────────────────────────────────────

export type ProductState = { error: string | null; productId?: string };

export async function saveProduct(
  data: ProductInput & {
    variants: VariantInput[];
    option_groups: OptionGroupInput[];
    image_path?: string;
    old_image_path?: string;
    old_image_id?: string;
  },
): Promise<ProductState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerRestaurant());
  } catch (e) {
    return { error: (e as Error).message };
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
      position: 0,
    });

    if (imgError) {
      // New image reference failed — delete the orphaned Storage file.
      await supabase.storage.from("product-images").remove([data.image_path]);
      return {
        error: `Producto guardado pero error al asociar imagen: ${imgError.message}`,
        productId: productId as string,
      };
    }

    // New image record saved — now safe to delete the old Storage file.
    if (data.old_image_path) {
      await supabase.storage
        .from("product-images")
        .remove([data.old_image_path]);
    }
  }

  revalidatePath("/panel/menu");
  revalidatePath("/r/[slug]", "page");
  return { error: null, productId: productId as string };
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
