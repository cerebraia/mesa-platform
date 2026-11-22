"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import {
  adminSetProductPublished,
  adminSoftDeleteProduct,
  adminRestoreProduct,
  adminHardDeleteProduct,
  adminDeleteCategory,
  adminSetCategoryActive,
  adminTransferAndDeleteCategory,
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
type PlanUsage = { product_count: number; max_products: number | null; plan_name: string | null };

interface Props {
  restaurantId: string;
  categories:   Category[];
  deleted:      DeletedProduct[];
  currency:     string;
  supabaseUrl:  string;
  planUsage?:   PlanUsage | null;
  atLimit?:     boolean;
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

// ── CategoryAdminRow ──────────────────────────────────────────

function CategoryAdminRow({
  restaurantId,
  category,
  allCategories,
  currency,
  supabaseUrl,
  atLimit,
}: {
  restaurantId: string;
  category: Category;
  allCategories: Category[];
  currency: string;
  supabaseUrl: string;
  atLimit?: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr]    = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [targetId, setTargetId] = useState(
    allCategories.find((c) => c.id !== category.id)?.id ?? "",
  );
  const router = useRouter();
  const imgBase = `${supabaseUrl}/storage/v1/object/public/product-images`;

  function act(fn: () => Promise<{ error: string | null }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="dashboard-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      {/* Category header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: category.is_active ? "transparent" : "rgba(0,0,0,.03)",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#202337" }}>
            {category.name}
          </span>
          {!category.is_active && (
            <span className="order-status-badge badge-rejected" style={{ fontSize: 10 }}>
              Inactiva
            </span>
          )}
          <span style={{ fontSize: 12, color: "#667085" }}>
            {category.products.length} producto{category.products.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Category actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* New product in this category */}
          {!atLimit && (
            <Link
              href={`/admin/restaurants/${restaurantId}/manage/menu/products/new?cat=${category.id}`}
              className="button secondary small"
              style={{ fontSize: 11 }}
            >
              <Plus size={11} /> Producto
            </Link>
          )}
          <Link
            href={`/admin/restaurants/${restaurantId}/manage/menu/categories/${category.id}/edit`}
            className="button secondary small"
            style={{ fontSize: 11 }}
          >
            <Pencil size={11} /> Editar
          </Link>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm(`¿${category.is_active ? "Archivar" : "Restaurar"} categoría "${category.name}"?`)) return;
              act(() => adminSetCategoryActive(restaurantId, category.id, !category.is_active));
            }}
            className="button secondary small"
            style={{ fontSize: 11 }}
          >
            {category.is_active ? "Archivar" : "Restaurar"}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (category.products.length > 0) { setShowTransfer(true); return; }
              if (!confirm(`¿Eliminar la categoría "${category.name}"? No se puede deshacer.`)) return;
              act(() => adminDeleteCategory(restaurantId, category.id));
            }}
            className="button secondary small"
            style={{ fontSize: 11, color: "#a72b38" }}
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* Transfer dialog */}
      {showTransfer && (
        <div
          style={{
            margin: "0 16px 8px", marginTop: 8,
            background: "#FFF7ED", border: "1px solid #FED7AA",
            borderRadius: 8, padding: "10px 12px", fontSize: 12,
          }}
        >
          <p style={{ color: "#92400E", marginBottom: 8, fontWeight: 600 }}>
            Esta categoría tiene {category.products.length} producto{category.products.length !== 1 ? "s" : ""}.
            Elige a dónde trasladarlos antes de eliminar.
          </p>
          {allCategories.filter((c) => c.id !== category.id).length === 0 ? (
            <p style={{ color: "#a72b38", fontSize: 11 }}>No hay otras categorías. Crea una primero.</p>
          ) : (
            <>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{ width: "100%", marginBottom: 8, fontSize: 12 }}
              >
                {allCategories
                  .filter((c) => c.id !== category.id)
                  .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={pending || !targetId}
                  onClick={() => {
                    if (!confirm(`¿Mover los productos a "${allCategories.find((c) => c.id === targetId)?.name ?? ""}" y eliminar "${category.name}"?`)) return;
                    act(() =>
                      adminTransferAndDeleteCategory(restaurantId, category.id, targetId).then(() => {
                        setShowTransfer(false);
                        return { error: null };
                      }),
                    );
                  }}
                  className="button small" style={{ fontSize: 11 }}
                >
                  {pending ? "…" : "Trasladar y eliminar"}
                </button>
                <button
                  onClick={() => setShowTransfer(false)}
                  className="button secondary small" style={{ fontSize: 11 }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {err && (
        <p className="auth-error" role="alert" style={{ margin: "0 16px 8px", fontSize: 12 }}>
          {err}
        </p>
      )}

      {/* Products table */}
      {category.products.length === 0 ? (
        <div style={{ padding: "14px 16px", fontSize: 13, color: "#667085" }}>
          Sin productos en esta categoría.{" "}
          {!atLimit && (
            <Link
              href={`/admin/restaurants/${restaurantId}/manage/menu/products/new?cat=${category.id}`}
              style={{ color: "var(--primary)", fontWeight: 500 }}
            >
              Agregar primer producto →
            </Link>
          )}
        </div>
      ) : (
        <ProductTable
          restaurantId={restaurantId}
          products={category.products}
          currency={currency}
          supabaseUrl={supabaseUrl}
          imgBase={imgBase}
        />
      )}
    </div>
  );
}

// ── ProductTable ──────────────────────────────────────────────

function ProductTable({
  restaurantId,
  products,
  currency,
  imgBase,
}: {
  restaurantId: string;
  products: Product[];
  currency: string;
  supabaseUrl: string;
  imgBase: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr]    = useState<string | null>(null);
  const router = useRouter();

  function act(fn: () => Promise<{ error: string | null }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else router.refresh();
    });
  }

  const sorted = [...products].sort((a, b) => a.position - b.position);

  return (
    <>
      {err && (
        <p className="auth-error" role="alert" style={{ margin: "0 16px 8px", fontSize: 12 }}>
          {err}
        </p>
      )}
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
            {sorted.map((p) => {
              const thumb = p.product_images.sort((a, b) => a.position - b.position)[0];
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${imgBase}/${thumb.storage_path}`}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: "#F6F7FB", flexShrink: 0 }} />
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
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link
                        href={`/admin/restaurants/${restaurantId}/manage/menu/products/${p.id}/edit`}
                        className="button secondary small"
                        style={{ fontSize: 11 }}
                      >
                        <Pencil size={11} /> Editar
                      </Link>
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
                        onClick={() => {
                          if (!confirm(`¿Eliminar "${p.name}"? Pasará a la papelera.`)) return;
                          act(() => adminSoftDeleteProduct(restaurantId, p.id));
                        }}
                        className="button secondary small"
                        style={{ fontSize: 11, color: "#a72b38" }}
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
    </>
  );
}

// ── Main export ───────────────────────────────────────────────

export function MenuAdminClient({
  restaurantId,
  categories,
  deleted,
  currency,
  supabaseUrl,
  atLimit,
}: Props) {
  const [activeTab, setActiveTab] = useState<"active" | "trash">("active");
  const [pending, start] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0);

  function act(fn: () => Promise<{ error: string | null }>) {
    setActionError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setActionError(r.error);
      else router.refresh();
    });
  }

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
          Papelera ({deleted.length})
        </button>
      </div>

      {actionError && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {/* ── Active products tab ── */}
      {activeTab === "active" && (
        <>
          {categories.length === 0 ? (
            <div className="panel-empty">
              <p className="panel-empty-title">Sin categorías</p>
              <p className="panel-empty-desc">
                Crea la primera categoría para empezar a agregar productos.
              </p>
              <Link
                href={`/admin/restaurants/${restaurantId}/manage/menu/categories/new`}
                className="button"
                style={{ marginTop: 12 }}
              >
                <Plus size={14} style={{ marginRight: 6 }} />
                Crear primera categoría
              </Link>
            </div>
          ) : (
            <>
              {categories.map((cat) => (
                <CategoryAdminRow
                  key={cat.id}
                  restaurantId={restaurantId}
                  category={cat}
                  allCategories={categories}
                  currency={currency}
                  supabaseUrl={supabaseUrl}
                  atLimit={atLimit}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* ── Trash tab ── */}
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
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            disabled={pending}
                            onClick={() => act(() => adminRestoreProduct(restaurantId, p.id))}
                            className="button secondary small"
                            style={{ fontSize: 11 }}
                          >
                            Restaurar
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => {
                              if (!confirm(`¿Eliminar definitivamente "${p.name}"? No se puede deshacer.`)) return;
                              act(() => adminHardDeleteProduct(restaurantId, p.id));
                            }}
                            className="button secondary small"
                            style={{ fontSize: 11, color: "#a72b38" }}
                          >
                            Eliminar definitivo
                          </button>
                        </div>
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
