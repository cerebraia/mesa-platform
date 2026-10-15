import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import type { Category, Product, ProductImage } from "@/lib/catalog-types";
import { CategoryActions } from "./category-actions";
import { ProductRowActions } from "./product-row-actions";

type ProductWithImage = Product & { product_images: ProductImage[] };
type CategoryWithProducts = Category & { products: ProductWithImage[] };

export default async function MenuPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/panel");

  const restaurantId = membership.restaurant_id;

  const { data: categories, error } = await supabase
    .from("categories")
    .select(`
      id, name, position, is_active, restaurant_id, created_at, updated_at,
      products (
        id, name, base_price_cents, promo_price_cents,
        is_available, is_published, position, restaurant_id,
        category_id, description, created_at, updated_at,
        product_images ( id, storage_path, position )
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("position", { ascending: true })
    .returns<CategoryWithProducts[]>();

  if (error) {
    throw new Error(`Error al cargar el catálogo: ${error.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const imagePublicBase = `${supabaseUrl}/storage/v1/object/public/product-images`;

  const cats = categories ?? [];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-bottom">
          <Link href="/panel" className="text-link" style={{ fontSize: 12 }}>
            ← Panel
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <span>MENÚ</span>
          <Link href="/panel/menu/categories/new" className="button small">
            + Categoría
          </Link>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1>Catálogo</h1>
              <p>Gestiona categorías, productos, variantes y extras.</p>
            </div>
          </div>

          {cats.length === 0 && (
            <div className="dashboard-card">
              <p style={{ color: "var(--muted)", fontSize: 14, padding: "24px 0" }}>
                Aún no hay categorías. Crea una para empezar.
              </p>
            </div>
          )}

          {cats.map((cat) => (
            <div
              key={cat.id}
              className="dashboard-card"
              style={{ marginBottom: 16, opacity: cat.is_active ? 1 : 0.55 }}
            >
              <div className="card-heading" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontSize: 17 }}>{cat.name}</h2>
                  {!cat.is_active && (
                    <span className="tag" style={{ fontSize: 10 }}>Archivada</span>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {cat.products?.length ?? 0} productos
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/panel/menu/categories/${cat.id}/edit`}
                    className="button secondary small"
                  >
                    Editar
                  </Link>
                  <CategoryActions categoryId={cat.id} isActive={cat.is_active} />
                </div>
              </div>

              {/* Product list */}
              <div className="table-scroll">
                <table style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 48 }} />
                      <th>Producto</th>
                      <th>Precio base</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(cat.products ?? [])
                      .sort((a, b) => a.position - b.position)
                      .map((p) => {
                        const imgPath = p.product_images?.[0]?.storage_path;
                        const imgUrl = imgPath
                          ? `${imagePublicBase}/${imgPath}`
                          : null;
                        return (
                          <tr key={p.id}>
                            <td>
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imgUrl}
                                  alt={p.name}
                                  width={36}
                                  height={36}
                                  style={{ borderRadius: 6, objectFit: "cover", display: "block" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 6,
                                    background: "var(--soft)",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 10,
                                    color: "var(--purple)",
                                  }}
                                >
                                  📷
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>{p.name}</strong>
                              {p.description && (
                                <div
                                  className="muted"
                                  style={{
                                    fontSize: 11,
                                    maxWidth: 280,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {p.description}
                                </div>
                              )}
                            </td>
                            <td>
                              ${((p.base_price_cents) / 100).toFixed(2)}
                              {p.promo_price_cents != null && (
                                <span
                                  className="tag"
                                  style={{ marginLeft: 8, fontSize: 10 }}
                                >
                                  Promo ${(p.promo_price_cents / 100).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className="tag"
                                style={{
                                  background: p.is_published
                                    ? "#e8f5e9"
                                    : "var(--soft)",
                                  color: p.is_published ? "#2e7d32" : "var(--purple)",
                                }}
                              >
                                {p.is_published
                                  ? p.is_available
                                    ? "Publicado"
                                    : "Pausado"
                                  : "Borrador"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <Link
                                  href={`/panel/menu/products/${p.id}/edit`}
                                  className="button secondary small"
                                  style={{ fontSize: 11 }}
                                >
                                  Editar
                                </Link>
                                <ProductRowActions
                                  productId={p.id}
                                  isPublished={p.is_published}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16 }}>
                <Link
                  href={`/panel/menu/products/new?category=${cat.id}`}
                  className="button secondary small"
                >
                  + Producto en {cat.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
