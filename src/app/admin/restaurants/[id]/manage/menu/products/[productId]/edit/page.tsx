import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { ProductFormPage } from "@/app/panel/menu/product-form";
import {
  adminSaveProduct,
  adminAddProductImage,
  adminRemoveProductImage,
  adminReorderProductImages,
  adminUpdateProductImagePaths,
  adminRestoreOriginalImage,
} from "../../../../actions";
import type {
  Category, ProductVariant, OptionGroup, Option, ProductImage,
} from "@/lib/catalog-types";

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}) {
  const { id, productId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) redirect("/admin");

  const db = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const { data: restaurant } = await db
    .from("restaurants").select("id, name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!restaurant) notFound();

  type ProductRow = {
    id: string; name: string; description: string | null;
    base_price_cents: number; promo_price_cents: number | null;
    is_available: boolean; is_published: boolean; position: number;
    category_id: string; restaurant_id: string; image_fit: string | null;
    created_at: string; updated_at: string;
  };
  const { data: productRaw } = await db
    .from("products")
    .select(
      "id, name, description, base_price_cents, promo_price_cents, " +
      "is_available, is_published, position, category_id, restaurant_id, " +
      "image_fit, created_at, updated_at",
    )
    .eq("id", productId)
    .eq("restaurant_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!productRaw) notFound();
  const product = productRaw as unknown as ProductRow;

  const [
    { data: catsRaw },
    { data: variantsRaw },
    { data: imagesRaw },
    { data: groupsRaw },
  ] = await Promise.all([
    db.from("categories")
      .select("id, name, position, is_active, restaurant_id, created_at, updated_at")
      .eq("restaurant_id", id).order("position"),
    db.from("product_variants")
      .select("id, product_id, restaurant_id, name, price_cents, is_available, position")
      .eq("product_id", productId).eq("restaurant_id", id).order("position"),
    db.from("product_images")
      .select("id, product_id, restaurant_id, storage_path, thumbnail_path, original_path, alt_text, position, created_at")
      .eq("product_id", productId).eq("restaurant_id", id).order("position"),
    db.from("option_groups")
      .select(
        "id, product_id, restaurant_id, name, min_selections, max_selections, position, " +
        "options(id, option_group_id, restaurant_id, name, price_delta_cents, is_available, position)",
      )
      .eq("product_id", productId).eq("restaurant_id", id).order("position"),
  ]);

  const categories = (catsRaw ?? []) as Category[];
  const variants   = (variantsRaw ?? []) as ProductVariant[];
  const images     = (imagesRaw ?? []) as ProductImage[];
  const groups     = ((groupsRaw ?? []) as unknown as Array<OptionGroup & { options: Option[] }>)
    .map((g) => ({ ...g, options: (g.options ?? []).sort((a, b) => a.position - b.position) }));

  const returnPath = `/admin/restaurants/${id}/manage/menu`;

  const saveAction: Parameters<typeof ProductFormPage>[0]["saveAction"] =
    (data) => adminSaveProduct(id, data);

  const imageGalleryActions: Parameters<typeof ProductFormPage>[0]["imageGalleryActions"] = {
    add:             (pid, sp, tp)             => adminAddProductImage(id, pid, sp, tp),
    remove:          (imgId)                   => adminRemoveProductImage(id, imgId),
    reorder:         (pid, ids)                => adminReorderProductImages(id, pid, ids),
    updatePaths:     (imgId, nsp, ntp, pao)    => adminUpdateProductImagePaths(id, imgId, nsp, ntp, pao),
    restoreOriginal: (imgId)                   => adminRestoreOriginalImage(id, imgId),
  };

  return (
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href={returnPath} className="panel-breadcrumb-link">
              ← Catálogo
            </Link>
          </div>
          <h1 className="panel-page-title">Editar producto</h1>
          <p className="panel-page-desc">
            {restaurant.name} · {product.name}
          </p>
        </div>
      </div>
      <ProductFormPage
        mode="edit"
        categories={categories}
        product={product}
        existingImages={images}
        existingVariants={variants}
        existingGroups={groups}
        restaurantId={id}
        saveAction={saveAction}
        returnPath={returnPath}
        imageGalleryActions={imageGalleryActions}
        stockEnabled={false}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
