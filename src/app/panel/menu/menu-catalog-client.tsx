"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  LayoutGrid,
  Layers,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import { CategoryActions } from "./category-actions";
import { ProductRowActions } from "./product-row-actions";
import type { Category, Product, ProductImage } from "@/lib/catalog-types";

type ProductWithImage = Product & { product_images: ProductImage[] };
type CategoryWithProducts = Category & { products: ProductWithImage[] };

function plural(n: number, s: string, p: string) {
  return `${n} ${n === 1 ? s : p}`;
}

function formatCents(cents: number | null) {
  if (cents == null) return <span style={{ color: "#9CA3AF", fontSize: 11 }}>Sin precio</span>;
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Thumb ─────────────────────────────────────────────────────────

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={44}
        height={44}
        style={{ borderRadius: 8, objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: 44, height: 44, borderRadius: 8,
        background: "#F6F7FB", display: "grid", placeItems: "center",
        color: "#667085", fontSize: 9, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: ".04em", flexShrink: 0,
      }}
    >
      IMG
    </div>
  );
}

// ── Products tab ──────────────────────────────────────────────────

function ProductsTab({
  cats,
  imageBase,
  catalogLabel,
}: {
  cats:         CategoryWithProducts[];
  imageBase:    string;
  catalogLabel: "menú" | "catálogo";
}) {
  const [search,   setSearch]   = useState("");
  const [catId,    setCatId]    = useState("");
  const [statusF,  setStatusF]  = useState("");

  const allProducts = useMemo(
    () => cats.flatMap((c) =>
      (c.products ?? []).map((p) => ({ ...p, _catName: c.name, _catId: c.id }))
    ),
    [cats],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allProducts.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) &&
          !(p.description ?? "").toLowerCase().includes(q)) return false;
      if (catId && p._catId !== catId) return false;
      // "published"  = visible in public catalog (pub AND avail)
      // "paused"     = published but not available (hidden from catalog)
      // "draft"      = not published
      if (statusF === "published" && !(p.is_published && p.is_available)) return false;
      if (statusF === "paused"    && !(p.is_published && !p.is_available)) return false;
      if (statusF === "draft"     &&    p.is_published)                    return false;
      return true;
    });
  }, [allProducts, search, catId, statusF]);

  const total     = allProducts.length;
  // Visible in public catalog: RLS requires is_published=true AND is_available=true
  const visible   = allProducts.filter((p) => p.is_published && p.is_available).length;
  // Published but hidden (paused/out of stock)
  const paused    = allProducts.filter((p) => p.is_published && !p.is_available).length;
  const drafts    = allProducts.filter((p) => !p.is_published).length;
  const hasFilter = search || catId || statusF;

  return (
    <>
      {/* Counters */}
      <div className="count-strip">
        <span className="count-chip">{total} <span>Total</span></span>
        <span className="count-chip" style={{ color: "#166534" }}>
          {visible} <span style={{ color: "#667085" }}>Visibles</span>
        </span>
        {paused > 0 && (
          <span className="count-chip" style={{ color: "#92400E" }}>
            {paused} <span style={{ color: "#667085" }}>Pausados</span>
          </span>
        )}
        {drafts > 0 && (
          <span className="count-chip" style={{ color: "#667085" }}>
            {drafts} <span>Borradores</span>
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="panel-filter-bar">
        <label className="filter-search-wrap">
          <Search size={14} />
          <input
            type="search"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar producto"
          />
        </label>

        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="published">Visibles en catálogo</option>
          <option value="paused">Pausados</option>
          <option value="draft">Borradores</option>
        </select>

        <span className="filter-count">{filtered.length} de {total}</span>
        {hasFilter && (
          <button
            className="filter-clear"
            onClick={() => { setSearch(""); setCatId(""); setStatusF(""); }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="panel-empty">
          <div className="panel-empty-icon"><Search size={22} strokeWidth={1.5} /></div>
          <p className="panel-empty-title">
            {total === 0 ? "Sin productos todavía" : "Sin resultados"}
          </p>
          <p className="panel-empty-desc">
            {total === 0
              ? "Crea tu primer producto para que aparezca aquí."
              : "No hay productos que coincidan con los filtros."}
          </p>
          {total === 0 ? (
            <Link href="/panel/menu/products/new" className="button small">
              <Plus size={13} /> Crear primer producto
            </Link>
          ) : (
            <button
              className="button secondary small"
              onClick={() => { setSearch(""); setCatId(""); setStatusF(""); }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56, paddingLeft: 20 }} />
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th style={{ paddingRight: 20 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const imgPath = p.product_images?.[0]?.storage_path;
                  const imgSrc  = imgPath ? `${imageBase}/${imgPath}` : null;
                  return (
                    <tr key={p.id} style={{ opacity: p.is_published ? 1 : 0.7 }}>
                      <td style={{ paddingLeft: 20 }}>
                        <Thumb src={imgSrc} alt={p.name} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#202337" }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: 11, color: "#667085", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "#667085" }}>{p._catName}</td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {formatCents(p.base_price_cents)}
                        {p.promo_price_cents != null && (
                          <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>
                            Promo {formatCents(p.promo_price_cents)}
                          </span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          // Determine the real visibility state:
                          // "Visible"  = pub=T AND avail=T   → shown in public catalog
                          // "Pausado"  = pub=T AND avail=F AND has price → manually hidden
                          // "Sin precio" = pub=T AND avail=F AND price=null → needs price before publishing
                          // "Borrador" = pub=F
                          if (!p.is_published) {
                            return (
                              <span className="order-status-badge"
                                style={{ background: "#F6F7FB", color: "#667085" }}>
                                Borrador
                              </span>
                            );
                          }
                          if (p.is_available) {
                            return (
                              <span className="order-status-badge"
                                style={{ background: "#D1FAE5", color: "#065F46" }}>
                                Visible
                              </span>
                            );
                          }
                          if (p.base_price_cents == null) {
                            return (
                              <span className="order-status-badge"
                                style={{ background: "#FEF3C7", color: "#92400E" }}>
                                Sin precio
                              </span>
                            );
                          }
                          return (
                            <span className="order-status-badge"
                              style={{ background: "#FEF3C7", color: "#92400E" }}>
                              Pausado
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ paddingRight: 20 }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <Link
                            href={`/panel/menu/products/${p.id}/edit`}
                            className="panel-quick-action"
                            style={{ padding: "6px 10px", fontSize: 11 }}
                            aria-label={`Editar ${p.name}`}
                          >
                            <Pencil size={12} /> Editar
                          </Link>
                          <ProductRowActions
                            productId={p.id}
                            productName={p.name}
                            isPublished={p.is_published}
                            catalogLabel={catalogLabel}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Categories tab ────────────────────────────────────────────────

function CategoriesTab({ cats }: { cats: CategoryWithProducts[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? cats.filter((c) => c.name.toLowerCase().includes(q)) : cats;
  }, [cats, search]);

  return (
    <>
      <div className="panel-filter-bar">
        <label className="filter-search-wrap">
          <Search size={14} />
          <input
            type="search"
            placeholder="Buscar categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar categoría"
          />
        </label>
        <span className="filter-count">{filtered.length} categorías</span>
        {search && (
          <button className="filter-clear" onClick={() => setSearch("")}>Limpiar</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="panel-empty">
          <div className="panel-empty-icon"><Layers size={22} strokeWidth={1.5} /></div>
          <p className="panel-empty-title">
            {cats.length === 0 ? "Sin categorías todavía" : "Sin resultados"}
          </p>
          <p className="panel-empty-desc">
            {cats.length === 0
              ? "Las categorías organizan los productos de tu menú."
              : "Ninguna categoría coincide con la búsqueda."}
          </p>
          {cats.length === 0 && (
            <Link href="/panel/menu/categories/new" className="button small">
              <Plus size={13} /> Crear primera categoría
            </Link>
          )}
        </div>
      ) : (
        <div>
          {filtered.map((cat) => {
            const productCount = cat.products?.length ?? 0;
            return (
              <div
                key={cat.id}
                className="cat-card"
                style={{ opacity: cat.is_active ? 1 : 0.6 }}
              >
                <div className="cat-card-icon">
                  <Layers size={16} strokeWidth={1.5} />
                </div>
                <div className="cat-card-info">
                  <div className="cat-card-name">{cat.name}</div>
                  <div className="cat-card-meta">
                    {plural(productCount, "producto", "productos")}
                    {!cat.is_active && (
                      <span className="order-status-badge badge-cancelled" style={{ marginLeft: 8, fontSize: 10 }}>
                        Archivada
                      </span>
                    )}
                  </div>
                </div>
                <div className="cat-card-actions">
                  <Link
                    href={`/panel/menu/categories/${cat.id}/edit`}
                    className="panel-quick-action"
                    style={{ padding: "6px 10px", fontSize: 11 }}
                    aria-label={`Editar categoría ${cat.name}`}
                  >
                    <Pencil size={12} /> Editar
                  </Link>
                  <CategoryActions categoryId={cat.id} isActive={cat.is_active} />
                  <Link
                    href={`/panel/menu/products/new?category=${cat.id}`}
                    className="panel-quick-action"
                    style={{ padding: "6px 10px", fontSize: 11 }}
                    aria-label={`Añadir producto a ${cat.name}`}
                  >
                    <Plus size={12} /> Producto
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Main client component ─────────────────────────────────────────

export function MenuCatalogClient({
  cats,
  imageBase,
  defaultTab,
  catalogLabel = "catálogo",
}: {
  cats:          CategoryWithProducts[];
  imageBase:     string;
  defaultTab:    "productos" | "categorias";
  catalogLabel?: "menú" | "catálogo";
}) {
  const [tab, setTab] = useState<"productos" | "categorias">(defaultTab);

  const totalProducts  = cats.reduce((s, c) => s + (c.products?.length ?? 0), 0);

  return (
    <>
      {/* Tabs */}
      <div className="panel-tabs">
        <button
          className={`panel-tab${tab === "productos" ? " panel-tab--active" : ""}`}
          onClick={() => setTab("productos")}
        >
          <LayoutGrid size={14} />
          Productos
          {totalProducts > 0 && (
            <span style={{ fontSize: 11, color: tab === "productos" ? "#703BE6" : "#667085" }}>
              ({totalProducts})
            </span>
          )}
        </button>
        <button
          className={`panel-tab${tab === "categorias" ? " panel-tab--active" : ""}`}
          onClick={() => setTab("categorias")}
        >
          <Layers size={14} />
          Categorías
          {cats.length > 0 && (
            <span style={{ fontSize: 11, color: tab === "categorias" ? "#703BE6" : "#667085" }}>
              ({cats.length})
            </span>
          )}
        </button>
      </div>

      {tab === "productos" ? (
        <ProductsTab cats={cats} imageBase={imageBase} catalogLabel={catalogLabel} />
      ) : (
        <CategoriesTab cats={cats} />
      )}
    </>
  );
}
