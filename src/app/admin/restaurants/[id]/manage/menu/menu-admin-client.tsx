"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminSetProductPublished, adminSoftDeleteProduct, adminRestoreProduct,
} from "../actions";

type Product = {
  id: string; name: string; base_price_cents: number | null;
  is_published: boolean; is_available: boolean;
  position: number;
  product_images: Array<{ id: string; storage_path: string; position: number }>;
};
type Category = {
  id: string; name: string; position: number; is_active: boolean;
  products: Product[];
};
type DeletedProduct = { id: string; name: string; category_id: string; deleted_at: string };

interface Props {
  restaurantId: string;
  categories:   Category[];
  deleted:      DeletedProduct[];
  currency:     string;
  supabaseUrl:  string;
}

function formatCents(cents: number | null, currency: string): string {
  if (cents == null) return "Sin precio";
  try {
    return new Intl.NumberFormat("es", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function MenuAdminClient({ restaurantId, categories, deleted, currency, supabaseUrl }: Props) {
  const [activeTab, setActiveTab] = useState<"active" | "trash">("active");
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0);

  function act(fn: () => Promise<{ error: string | null }>) {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setActionError(res.error);
      else router.refresh();
    });
  }

  const imgUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;

  return (
    <>
      <div className="panel-tabs" style={{ marginBottom: 16 }}>
        <button
          className={`panel-tab${activeTab === "active" ? " panel-tab--active" : ""}`}
          onClick={() => setActiveTab("active")}
        >
          Productos ({totalProducts})
        </button>
        <button
          className={`panel-tab${activeTab === "trash" ? " panel-tab--active" : ""}`}
          onClick={() => setActiveTab("trash")}
        >
          Eliminados ({deleted.length})
        </button>
      </div>

      {actionError && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {activeTab === "active" && (
        <>
          {categories.length === 0 ? (
            <div className="panel-empty">
              <p className="panel-empty-title">Sin categorías</p>
              <p className="panel-empty-desc">Este negocio no tiene categorías aún.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="dashboard-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px",
                  background: cat.is_active ? "transparent" : "rgba(0,0,0,.03)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#202337" }}>{cat.name}</span>
                    {!cat.is_active && (
                      <span className="order-status-badge badge-rejected" style={{ marginLeft: 8, fontSize: 10 }}>
                        Inactiva
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#667085" }}>
                    {cat.products.length} producto{cat.products.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {cat.products.length === 0 ? (
                  <div style={{ padding: "12px 16px", fontSize: 13, color: "#667085" }}>
                    Sin productos en esta categoría.
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Precio</th>
                          <th>Estado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {cat.products.map((p) => {
                          const thumb = p.product_images.sort((a, b) => a.position - b.position)[0];
                          return (
                            <tr key={p.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {thumb ? (
                                    <img
                                      src={imgUrl(thumb.storage_path)}
                                      alt=""
                                      style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: 40, height: 40, borderRadius: 6,
                                      background: "#F6F7FB", flexShrink: 0,
                                    }} />
                                  )}
                                  <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                                </div>
                              </td>
                              <td style={{ fontSize: 13 }}>{formatCents(p.base_price_cents, currency)}</td>
                              <td>
                                {p.is_published ? (
                                  <span className="order-status-badge badge-ready" style={{ fontSize: 11 }}>Publicado</span>
                                ) : (
                                  <span className="order-status-badge badge-cancelled" style={{ fontSize: 11 }}>Borrador</span>
                                )}
                                {!p.is_available && (
                                  <span className="order-status-badge badge-rejected" style={{ fontSize: 10, marginLeft: 4 }}>Agotado</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    disabled={pending}
                                    onClick={() => act(() => adminSetProductPublished(restaurantId, p.id, !p.is_published))}
                                    className="button secondary small"
                                    style={{ fontSize: 11 }}
                                  >
                                    {p.is_published ? "Despublicar" : "Publicar"}
                                  </button>
                                  <button
                                    disabled={pending}
                                    onClick={() => act(() => adminSoftDeleteProduct(restaurantId, p.id))}
                                    className="button secondary small"
                                    style={{ fontSize: 11, color: "#DC2626", borderColor: "#FCA5A5" }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {activeTab === "trash" && (
        deleted.length === 0 ? (
          <div className="panel-empty">
            <p className="panel-empty-title">Sin productos eliminados</p>
          </div>
        ) : (
          <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Eliminado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deleted.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 13 }}>{p.name}</td>
                      <td style={{ fontSize: 12, color: "#667085" }}>
                        {new Date(p.deleted_at).toLocaleDateString("es-VE")}
                      </td>
                      <td>
                        <button
                          disabled={pending}
                          onClick={() => act(() => adminRestoreProduct(restaurantId, p.id))}
                          className="button secondary small"
                          style={{ fontSize: 11 }}
                        >
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </>
  );
}
