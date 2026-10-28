"use client";

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useFormStatus } from "react-dom";
import {
  saveIdentity,
  saveAppearanceConfig,
  saveCatalogMode,
  saveConfigImage,
  removeConfigImage,
  type ConfigState,
} from "./actions";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import type { RestaurantConfig } from "@/lib/catalog-types";

// ── Shared helpers ────────────────────────────────────────────────

function SaveBtn({ label, disabled }: { label?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="button"
      disabled={pending || disabled}
      style={{ minWidth: 140 }}
    >
      {pending ? "Guardando…" : (label ?? "Guardar cambios")}
    </button>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <p className="cfg-success" role="status" aria-live="polite">
      ✓ {message}
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="auth-error" role="alert">
      {message}
    </p>
  );
}

function DirtyBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="cfg-dirty-badge" aria-label="Cambios sin guardar">Sin guardar</span>;
}

function SectionFooter({
  state,
  isDirty,
  saveLabel,
  onDiscard,
}: {
  state:     ConfigState;
  isDirty:   boolean;
  saveLabel?: string;
  onDiscard: () => void;
}) {
  return (
    <div className="cfg-form-footer">
      {state.error   && <ErrorBanner   message={state.error} />}
      {state.success && <SuccessBanner message="Cambios guardados." />}
      <div className="cfg-form-actions">
        <DirtyBadge show={isDirty} />
        {isDirty && (
          <button type="button" className="button secondary small" onClick={onDiscard}>
            Descartar
          </button>
        )}
        <SaveBtn label={saveLabel} disabled={!isDirty} />
      </div>
    </div>
  );
}

function detectImageType(b: Uint8Array): boolean {
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

const ASSET_BASE = (url: string) =>
  `${url}/storage/v1/object/public/restaurant-assets`;

// ── NegocioForm ───────────────────────────────────────────────────

export function NegocioForm({
  restaurant,
  config,
  timezones,
}: {
  restaurant: { id: string; name: string; slug: string; timezone: string };
  config?: RestaurantConfig;
  timezones: string[];
}) {
  const initial: ConfigState = { error: null };
  const [state, action] = useActionState(saveIdentity, initial);
  const [isDirty, setIsDirty] = useState(false);
  const { setDirty, setSaveHandler } = useUnsavedChanges();
  const formRef        = useRef<HTMLFormElement | null>(null);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const prevState      = useRef(initial);

  // form key forces a reset when we discard
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state === prevState.current) return;
    prevState.current = state;
    if (state.success) { setIsDirty(false); setDirty(false); }
    if (state.error)   { setIsDirty(true);  setDirty(true); }
    if (saveResolveRef.current) {
      saveResolveRef.current(!!state.success && !state.error);
      saveResolveRef.current = null;
    }
  }, [state, setDirty]);

  useEffect(() => {
    if (isDirty) {
      setSaveHandler(() => new Promise<boolean>((resolve) => {
        saveResolveRef.current = resolve;
        formRef.current?.requestSubmit();
      }));
    } else {
      setSaveHandler(null);
    }
    return () => { setSaveHandler(null); };
  }, [isDirty, setSaveHandler]);

  function markDirty() { setIsDirty(true); setDirty(true); }
  function discard()   { setFormKey((k) => k + 1); setIsDirty(false); setDirty(false); }

  return (
    <form ref={formRef} key={formKey} action={action} onChange={markDirty} onSubmit={() => setIsDirty(false)}>
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Identidad</h3>
          <p className="cfg-card-desc">Nombre público y descripción del negocio.</p>
        </div>

        <div className="cfg-grid-2">
          <div className="field">
            <label htmlFor="cf-name">Nombre del negocio *</label>
            <input id="cf-name" name="name" type="text" maxLength={100} required
              defaultValue={restaurant.name}
              placeholder="Ej: Lanze Technology" />
          </div>
          <div className="field">
            <label htmlFor="cf-slug">
              Enlace único
              <span className="cfg-field-hint">Solo lectura — cambiar rompe URLs existentes</span>
            </label>
            <input id="cf-slug" value={`mesa.app/r/${restaurant.slug}`} readOnly
              className="cfg-readonly-input" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="cf-desc">Descripción breve</label>
          <input id="cf-desc" name="description" type="text" maxLength={300}
            defaultValue={config?.description ?? ""}
            placeholder="Ej: Tecnología DJI en Venezuela. Envíos nacionales." />
          <span className="cfg-field-hint">Visible en el encabezado del catálogo.</span>
        </div>

        <div className="field">
          <label htmlFor="cf-tz">Zona horaria *</label>
          <select id="cf-tz" name="timezone" defaultValue={restaurant.timezone} required>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <span className="cfg-field-hint">Usada para calcular el estado abierto/cerrado.</span>
        </div>

        <div className="field">
          <label htmlFor="cf-addr">Dirección del local</label>
          <input id="cf-addr" name="address" type="text" maxLength={300}
            defaultValue={config?.address ?? ""}
            placeholder="Av. Principal, Local 5, Caracas" />
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Contacto</h3>
          <p className="cfg-card-desc">Datos de contacto visibles en el catálogo público.</p>
        </div>

        <div className="cfg-grid-2">
          <div className="field">
            <label htmlFor="cf-phone">Teléfono</label>
            <input id="cf-phone" name="phone" type="tel" maxLength={30}
              defaultValue={config?.phone ?? ""} placeholder="+58 412 000 0000" />
          </div>
          <div className="field">
            <label htmlFor="cf-wa">WhatsApp del negocio</label>
            <input id="cf-wa" name="whatsapp" type="tel" maxLength={30}
              defaultValue={config?.whatsapp ?? ""} placeholder="+58 412 000 0000" />
            <span className="cfg-field-hint">El botón "Consultar" del catálogo usa este número.</span>
          </div>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Redes sociales</h3>
          <p className="cfg-card-desc">URLs completas de los perfiles del negocio.</p>
        </div>

        <div className="cfg-grid-3">
          <div className="field">
            <label htmlFor="cf-ig">Instagram</label>
            <input id="cf-ig" name="instagram_url" type="url" maxLength={200}
              defaultValue={config?.instagram_url ?? ""}
              placeholder="https://instagram.com/tunegocio" />
          </div>
          <div className="field">
            <label htmlFor="cf-fb">Facebook</label>
            <input id="cf-fb" name="facebook_url" type="url" maxLength={200}
              defaultValue={config?.facebook_url ?? ""}
              placeholder="https://facebook.com/tunegocio" />
          </div>
          <div className="field">
            <label htmlFor="cf-tw">X / Twitter</label>
            <input id="cf-tw" name="twitter_url" type="url" maxLength={200}
              defaultValue={config?.twitter_url ?? ""}
              placeholder="https://twitter.com/tunegocio" />
          </div>
        </div>
      </div>

      <SectionFooter state={state} isDirty={isDirty} saveLabel="Guardar datos" onDiscard={discard} />
    </form>
  );
}

// ── CatalogPreview ────────────────────────────────────────────────

function CatalogPreview({
  primaryColor,
  bgColor,
  fontFamily,
  businessName,
  logoUrl,
}: {
  primaryColor: string;
  bgColor:      string;
  fontFamily:   string;
  businessName: string;
  logoUrl:      string | null;
}) {
  const font = fontFamily === "Nunito"
    ? "var(--font-nunito,'Nunito',Arial,sans-serif)"
    : "var(--font-poppins,'Poppins',Arial,sans-serif)";
  const initials = businessName.slice(0, 2).toUpperCase() || "NE";

  return (
    <div className="cfg-preview-frame" style={{ fontFamily: font, background: bgColor || "#ffffff" }}>
      {/* Header strip */}
      <div className="cfg-preview-header" style={{ background: primaryColor }}>
        <div className="cfg-preview-logo" aria-hidden="true">
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials}
        </div>
        <span className="cfg-preview-biz" style={{ fontFamily: font }}>{businessName || "Mi negocio"}</span>
      </div>

      {/* Category tabs */}
      <div className="cfg-preview-cats" style={{ background: bgColor || "#fff", borderBottom: `1px solid ${primaryColor}30` }}>
        <span className="cfg-preview-cat--active" style={{ color: primaryColor, borderBottomColor: primaryColor, fontFamily: font }}>Todos</span>
        <span className="cfg-preview-cat" style={{ fontFamily: font }}>Categoría 1</span>
        <span className="cfg-preview-cat" style={{ fontFamily: font }}>Categoría 2</span>
      </div>

      {/* Product grid sample */}
      <div className="cfg-preview-grid" style={{ background: bgColor || "#f6f7fb" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="cfg-preview-card" style={{ background: "#fff" }}>
            <div className="cfg-preview-card-img"
              style={{ background: `${primaryColor}18` }} />
            <div className="cfg-preview-card-body" style={{ fontFamily: font }}>
              <span className="cfg-preview-card-name">Producto {i}</span>
              <span className="cfg-preview-card-price" style={{ color: primaryColor }}>$25.00</span>
            </div>
          </div>
        ))}
      </div>

      <div className="cfg-preview-watermark">Vista previa — sin efecto real</div>
    </div>
  );
}

// ── AppearanceForm ────────────────────────────────────────────────

export function AppearanceForm({
  restaurant,
  config,
  supabaseUrl,
  restaurantId,
}: {
  restaurant:   { id: string; name: string };
  config?:      RestaurantConfig;
  supabaseUrl:  string;
  restaurantId: string;
}) {
  const initial: ConfigState = { error: null };
  const [state, action] = useActionState(saveAppearanceConfig, initial);
  const [isDirty, setIsDirty] = useState(false);
  const { setDirty, setSaveHandler } = useUnsavedChanges();
  const [formKey, setFormKey] = useState(0);
  const formRef        = useRef<HTMLFormElement | null>(null);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const prevState      = useRef(initial);

  // Live preview state (controlled)
  const [primaryColor,    setPrimaryColor]    = useState(config?.primary_color    ?? "#703BE6");
  const [bgColor,         setBgColor]         = useState(config?.background_color ?? "#ffffff");
  const [fontFamily,      setFontFamily]      = useState(config?.font_family      ?? "");

  // Image upload/remove state
  const [imgUpload,  startImgTransition] = useTransition();
  const [imgError,   setImgError]        = useState<string | null>(null);
  const [imgSuccess, setImgSuccess]      = useState<string | null>(null);
  // Optimistic local state — reflects pending remove before reload
  const [localLogoPath,  setLocalLogoPath]  = useState(config?.logo_path  ?? null);
  const [localCoverPath, setLocalCoverPath] = useState(config?.cover_path ?? null);

  const logoUrl  = localLogoPath
    ? `${ASSET_BASE(supabaseUrl)}/${localLogoPath}`
    : null;
  const coverUrl = localCoverPath
    ? `${ASSET_BASE(supabaseUrl)}/${localCoverPath}`
    : null;

  useEffect(() => {
    if (state === prevState.current) return;
    prevState.current = state;
    if (state.success) { setIsDirty(false); setDirty(false); }
    if (state.error)   { setIsDirty(true);  setDirty(true); }
    if (saveResolveRef.current) {
      saveResolveRef.current(!!state.success && !state.error);
      saveResolveRef.current = null;
    }
  }, [state, setDirty]);

  useEffect(() => {
    if (isDirty) {
      setSaveHandler(() => new Promise<boolean>((resolve) => {
        saveResolveRef.current = resolve;
        formRef.current?.requestSubmit();
      }));
    } else {
      setSaveHandler(null);
    }
    return () => { setSaveHandler(null); };
  }, [isDirty, setSaveHandler]);

  function markDirty() { setIsDirty(true); setDirty(true); }

  function discard() {
    setFormKey((k) => k + 1);
    setPrimaryColor(config?.primary_color    ?? "#703BE6");
    setBgColor(     config?.background_color ?? "#ffffff");
    setFontFamily(  config?.font_family      ?? "");
    setIsDirty(false);
    setDirty(false);
  }

  async function uploadImg(file: File, type: "logo" | "cover") {
    if (file.size > 5 * 1024 * 1024) { setImgError("La imagen supera 5 MB."); return; }
    const buf = await file.arrayBuffer();
    const hdr = new Uint8Array(buf.slice(0, 12));
    if (!detectImageType(hdr)) { setImgError("Formato no válido. Usa JPEG, PNG o WebP."); return; }
    setImgError(null);
    setImgSuccess(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("restaurant_id", restaurantId);
    fd.append("type", type);

    startImgTransition(async () => {
      const res  = await fetch("/api/menu/upload", { method: "POST", body: fd });
      const json = await res.json() as { path?: string; error?: string };
      if (!res.ok || json.error) { setImgError(json.error ?? "Error al subir imagen."); return; }
      // DB update — if this fails, the new file is orphaned (recoverable via Storage console)
      const result = await saveConfigImage(`${type}_path`, json.path!);
      if (result.error) {
        setImgError(result.error);
        // Don't reload — keep current UI so user can retry or see the error
        return;
      }
      setImgSuccess(type === "logo" ? "Logo actualizado." : "Portada actualizada.");
      // Reflect new path immediately without full reload
      if (type === "logo")  setLocalLogoPath(json.path!);
      else                  setLocalCoverPath(json.path!);
    });
  }

  async function removeImg(type: "logo" | "cover") {
    setImgError(null);
    setImgSuccess(null);
    startImgTransition(async () => {
      const result = await removeConfigImage(`${type}_path`);
      if (result.error) { setImgError(result.error); return; }
      setImgSuccess(type === "logo" ? "Logo eliminado." : "Portada eliminada.");
      if (type === "logo")  setLocalLogoPath(null);
      else                  setLocalCoverPath(null);
    });
  }

  const COLOR_PRESETS = [
    { label: "Mesa",      primary: "#703BE6", bg: "#faf9fc" },
    { label: "Verde",     primary: "#059669", bg: "#f0fdf4" },
    { label: "Azul",      primary: "#2563eb", bg: "#eff6ff" },
    { label: "Coral",     primary: "#e63946", bg: "#fff5f5" },
    { label: "Ámbar",     primary: "#d97706", bg: "#fffbeb" },
    { label: "Neutro",    primary: "#374151", bg: "#f9fafb" },
  ];

  function applyPreset(p: { primary: string; bg: string }) {
    setPrimaryColor(p.primary);
    setBgColor(p.bg);
    markDirty();
  }

  return (
    <div className="cfg-appearance-layout">
      {/* ── Editor column ─────────────────────────────────────── */}
      <div className="cfg-appearance-editor">
        {/* Images */}
        <div className="dashboard-card" style={{ marginBottom: 16 }}>
          <div className="cfg-card-heading">
            <h3 className="cfg-card-title">Imágenes</h3>
            <p className="cfg-card-desc">JPEG, PNG o WebP · máx. 5 MB</p>
          </div>

          <div className="cfg-images-grid">
            {/* Logo */}
            <div className="cfg-image-block">
              <div className="cfg-image-label">Logo</div>
              <div className="cfg-image-slot cfg-image-slot--square">
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="Logo actual" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <span className="cfg-image-placeholder" aria-hidden="true">LO</span>}
              </div>
              <div className="cfg-image-actions">
                <label className="cfg-image-btn">
                  <span>{logoUrl ? "Reemplazar" : "Subir logo"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={imgUpload}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImg(f, "logo"); }}
                    style={{ display: "none" }}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    className="cfg-image-btn cfg-image-btn--remove"
                    disabled={imgUpload}
                    onClick={() => removeImg("logo")}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="cfg-image-hint">Recomendado: 400×400 px, fondo transparente o blanco.</p>
            </div>

            {/* Cover */}
            <div className="cfg-image-block">
              <div className="cfg-image-label">Portada</div>
              <div className="cfg-image-slot cfg-image-slot--wide">
                {coverUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={coverUrl} alt="Portada actual" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span className="cfg-image-placeholder" aria-hidden="true">Portada</span>}
              </div>
              <div className="cfg-image-actions">
                <label className="cfg-image-btn">
                  <span>{coverUrl ? "Reemplazar" : "Subir portada"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={imgUpload}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImg(f, "cover"); }}
                    style={{ display: "none" }}
                  />
                </label>
                {coverUrl && (
                  <button
                    type="button"
                    className="cfg-image-btn cfg-image-btn--remove"
                    disabled={imgUpload}
                    onClick={() => removeImg("cover")}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="cfg-image-hint">Recomendado: 1440×400 px. Si no hay portada, se usa el color de marca.</p>
            </div>
          </div>

          {imgUpload  && <p className="cfg-img-status" aria-live="polite">Subiendo imagen…</p>}
          {imgError   && <ErrorBanner   message={imgError} />}
          {imgSuccess && <SuccessBanner message={imgSuccess} />}
        </div>

        {/* Colors */}
        <form ref={formRef} key={formKey} action={action}
          onChange={() => { markDirty(); }}
          onSubmit={() => setIsDirty(false)}>
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div className="cfg-card-heading">
              <h3 className="cfg-card-title">Colores</h3>
              <p className="cfg-card-desc">Afectan precios, botones, tabs y el fondo del catálogo.</p>
            </div>

            {/* Presets */}
            <div className="cfg-color-presets">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="cfg-preset-swatch"
                  style={{ background: p.primary }}
                  onClick={() => applyPreset(p)}
                  title={p.label}
                  aria-label={`Aplicar combinación ${p.label}`}
                >
                  <span className="cfg-preset-label">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="cfg-field-hint" style={{ marginBottom: 16 }}>
              Toca un preset para aplicarlo. Los cambios solo se guardan al pulsar "Guardar".
            </p>

            <div className="cfg-grid-2">
              <div className="field">
                <label>Color principal</label>
                <div className="cfg-color-row">
                  <input
                    name="primary_color" type="color"
                    value={primaryColor}
                    onChange={(e) => { setPrimaryColor(e.target.value); markDirty(); }}
                    className="cfg-color-input"
                    aria-label="Color principal"
                  />
                  <div>
                    <span className="cfg-color-code">{primaryColor}</span>
                    <span className="cfg-field-hint">Precio, tabs y acentos.</span>
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Color de fondo</label>
                <div className="cfg-color-row">
                  <input
                    name="background_color" type="color"
                    value={bgColor || "#ffffff"}
                    onChange={(e) => { setBgColor(e.target.value); markDirty(); }}
                    className="cfg-color-input"
                    aria-label="Color de fondo"
                  />
                  <div>
                    <span className="cfg-color-code">{bgColor || "#ffffff"}</span>
                    <span className="cfg-field-hint">Fondo del catálogo.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="dashboard-card" style={{ marginBottom: 16 }}>
            <div className="cfg-card-heading">
              <h3 className="cfg-card-title">Tipografía</h3>
              <p className="cfg-card-desc">Fuente usada en el catálogo público.</p>
            </div>
            <div className="cfg-font-options">
              {[
                { value: "",       label: "Poppins",  desc: "Geométrica y moderna (por defecto)" },
                { value: "Nunito", label: "Nunito",   desc: "Redondeada y amigable" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`cfg-font-option${fontFamily === opt.value ? " cfg-font-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="font_family"
                    value={opt.value}
                    checked={fontFamily === opt.value}
                    onChange={() => { setFontFamily(opt.value); markDirty(); }}
                    style={{ accentColor: primaryColor }}
                  />
                  <div>
                    <span
                      className="cfg-font-name"
                      style={{ fontFamily: opt.value === "Nunito" ? "'Nunito',sans-serif" : "'Poppins',sans-serif" }}
                    >
                      {opt.label}
                    </span>
                    <span className="cfg-font-desc">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <SectionFooter state={state} isDirty={isDirty} saveLabel="Guardar apariencia" onDiscard={discard} />
        </form>
      </div>

      {/* ── Preview column ─────────────────────────────────────── */}
      <aside className="cfg-appearance-preview" aria-label="Vista previa del catálogo">
        <div className="cfg-preview-label">Vista previa</div>
        <CatalogPreview
          primaryColor={primaryColor}
          bgColor={bgColor}
          fontFamily={fontFamily}
          businessName={restaurant.name}
          logoUrl={logoUrl}
        />
      </aside>
    </div>
  );
}

// ── CatalogModeForm ───────────────────────────────────────────────

export function CatalogModeForm({
  config,
  restaurant,
}: {
  config?: RestaurantConfig;
  restaurant: { name: string };
}) {
  const initial: ConfigState = { error: null };
  const [state, action] = useActionState(saveCatalogMode, initial);
  const [isDirty, setIsDirty] = useState(false);
  const { setDirty, setSaveHandler } = useUnsavedChanges();
  const [formKey, setFormKey] = useState(0);
  const formRef        = useRef<HTMLFormElement | null>(null);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const prevState      = useRef(initial);

  const [ordersEnabled, setOrdersEnabled] = useState(config?.orders_enabled ?? true);
  const [pickupEnabled, setPickupEnabled] = useState(config?.pickup_enabled ?? false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(config?.delivery_enabled ?? false);
  const [isClosed, setIsClosed] = useState(config?.is_temporarily_closed ?? false);
  const [stockEnabled, setStockEnabled] = useState(config?.stock_tracking_enabled ?? false);

  useEffect(() => {
    if (state === prevState.current) return;
    prevState.current = state;
    if (state.success) { setIsDirty(false); setDirty(false); }
    if (state.error)   { setIsDirty(true);  setDirty(true); }
    if (saveResolveRef.current) {
      saveResolveRef.current(!!state.success && !state.error);
      saveResolveRef.current = null;
    }
  }, [state, setDirty]);

  useEffect(() => {
    if (isDirty) {
      setSaveHandler(() => new Promise<boolean>((resolve) => {
        saveResolveRef.current = resolve;
        formRef.current?.requestSubmit();
      }));
    } else {
      setSaveHandler(null);
    }
    return () => { setSaveHandler(null); };
  }, [isDirty, setSaveHandler]);

  function markDirty() { setIsDirty(true); setDirty(true); }

  function discard() {
    setFormKey((k) => k + 1);
    setOrdersEnabled(config?.orders_enabled ?? true);
    setPickupEnabled(config?.pickup_enabled ?? false);
    setDeliveryEnabled(config?.delivery_enabled ?? false);
    setIsClosed(config?.is_temporarily_closed ?? false);
    setStockEnabled(config?.stock_tracking_enabled ?? false);
    setIsDirty(false);
    setDirty(false);
  }

  return (
    <form ref={formRef} key={formKey} action={action} onChange={markDirty} onSubmit={() => setIsDirty(false)}>
      {/* Mode selector */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Modo del catálogo</h3>
          <p className="cfg-card-desc">Define cómo interactúan tus clientes con los productos.</p>
        </div>

        <input type="hidden" name="orders_enabled" value="false" />

        <div className="cfg-mode-grid">
          <label
            className={`cfg-mode-card${!ordersEnabled ? " cfg-mode-card--active" : ""}`}
            onClick={() => { setOrdersEnabled(false); markDirty(); }}
          >
            <input
              type="radio" name="orders_enabled" value="false"
              checked={!ordersEnabled}
              onChange={() => { setOrdersEnabled(false); markDirty(); }}
              style={{ accentColor: "var(--purple)" }}
            />
            <div className="cfg-mode-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="9" x2="9" y2="21" />
              </svg>
            </div>
            <div>
              <div className="cfg-mode-title">Solo catálogo</div>
              <div className="cfg-mode-desc">
                Los clientes exploran los productos y consultan por WhatsApp. Sin carrito ni pedidos en línea.
              </div>
            </div>
          </label>

          <label
            className={`cfg-mode-card${ordersEnabled ? " cfg-mode-card--active" : ""}`}
            onClick={() => { setOrdersEnabled(true); markDirty(); }}
          >
            <input
              type="radio" name="orders_enabled" value="true"
              checked={ordersEnabled}
              onChange={() => { setOrdersEnabled(true); markDirty(); }}
              style={{ accentColor: "var(--purple)" }}
            />
            <div className="cfg-mode-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <div className="cfg-mode-title">Catálogo con pedidos</div>
              <div className="cfg-mode-desc">
                Los clientes pueden añadir productos al carrito y enviar pedidos en línea. Requiere configurar entregas y pagos.
              </div>
            </div>
          </label>
        </div>

        <p className="cfg-field-hint" style={{ marginTop: 8 }}>
          Cambiar la modalidad no elimina el historial de pedidos ni las configuraciones guardadas.
        </p>
      </div>

      {/* Delivery methods (only shown when orders enabled) */}
      {ordersEnabled && (
        <div className="dashboard-card" style={{ marginBottom: 16 }}>
          <div className="cfg-card-heading">
            <h3 className="cfg-card-title">Métodos de entrega</h3>
            <p className="cfg-card-desc">Activa las modalidades disponibles para tus clientes.</p>
          </div>

          <div className="cfg-toggle-group">
            <div className="cfg-toggle-row">
              <div>
                <div className="cfg-toggle-label">Retiro en local</div>
                <div className="cfg-toggle-desc">El cliente pasa a recoger su pedido.</div>
              </div>
              <label className="cfg-switch">
                <input
                  type="hidden" name="pickup_enabled" value="false"
                />
                <input
                  type="checkbox" name="pickup_enabled" value="true"
                  checked={pickupEnabled}
                  onChange={(e) => { setPickupEnabled(e.target.checked); markDirty(); }}
                  style={{ accentColor: "var(--purple)" }}
                />
                <span className="cfg-switch-track" />
              </label>
            </div>

            {pickupEnabled && (
              <div className="cfg-toggle-fields">
                <div className="field">
                  <label htmlFor="cf-pa">Dirección de retiro</label>
                  <input id="cf-pa" name="pickup_address" type="text" maxLength={300}
                    defaultValue={config?.pickup_address ?? ""}
                    placeholder="Ej: Av. Libertad, Local 3, piso 1" />
                </div>
                <div className="field">
                  <label htmlFor="cf-pn">Instrucciones</label>
                  <input id="cf-pn" name="pickup_notes" type="text" maxLength={500}
                    defaultValue={config?.pickup_notes ?? ""}
                    placeholder="Ej: Preguntar por Ana en caja" />
                </div>
              </div>
            )}

            <div className="cfg-toggle-row">
              <div>
                <div className="cfg-toggle-label">Delivery</div>
                <div className="cfg-toggle-desc">Entregas a domicilio. Configura las zonas en la pestaña Entregas.</div>
              </div>
              <label className="cfg-switch">
                <input type="hidden" name="delivery_enabled" value="false" />
                <input
                  type="checkbox" name="delivery_enabled" value="true"
                  checked={deliveryEnabled}
                  onChange={(e) => { setDeliveryEnabled(e.target.checked); markDirty(); }}
                  style={{ accentColor: "var(--purple)" }}
                />
                <span className="cfg-switch-track" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Temporary closing */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Cierre temporal</h3>
          <p className="cfg-card-desc">Muestra un aviso en el catálogo sin desactivar los productos.</p>
        </div>

        <div className="cfg-toggle-group">
          <div className="cfg-toggle-row">
            <div>
              <div className="cfg-toggle-label">Cerrar temporalmente</div>
              <div className="cfg-toggle-desc">Los clientes ven el aviso pero pueden seguir explorando el catálogo.</div>
            </div>
            <label className="cfg-switch">
              <input type="hidden" name="is_temporarily_closed" value="false" />
              <input
                type="checkbox" name="is_temporarily_closed" value="true"
                checked={isClosed}
                onChange={(e) => { setIsClosed(e.target.checked); markDirty(); }}
                style={{ accentColor: "var(--purple)" }}
              />
              <span className="cfg-switch-track" />
            </label>
          </div>

          {isClosed && (
            <div className="cfg-toggle-fields">
              <div className="field">
                <label htmlFor="cf-cm">Mensaje de cierre</label>
                <input id="cf-cm" name="closed_message" type="text" maxLength={200}
                  defaultValue={config?.closed_message ?? ""}
                  placeholder="Ej: Volvemos mañana a las 11:00" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock tracking */}
      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <div className="cfg-card-heading">
          <h3 className="cfg-card-title">Control de existencias</h3>
          <p className="cfg-card-desc">Registra costo y stock por producto. Visible en Finanzas.</p>
        </div>
        <div className="cfg-toggle-group">
          <div className="cfg-toggle-row">
            <div>
              <div className="cfg-toggle-label">Activar seguimiento de inventario</div>
              <div className="cfg-toggle-desc">Aparecerá el bloque "Control del producto" en cada ficha del catálogo.</div>
            </div>
            <label className="cfg-switch">
              <input type="hidden" name="stock_tracking_enabled" value="false" />
              <input
                type="checkbox" name="stock_tracking_enabled" value="true"
                checked={stockEnabled}
                onChange={(e) => { setStockEnabled(e.target.checked); markDirty(); }}
                style={{ accentColor: "var(--purple)" }}
              />
              <span className="cfg-switch-track" />
            </label>
          </div>
        </div>
      </div>

      <SectionFooter state={state} isDirty={isDirty} saveLabel="Guardar configuración" onDiscard={discard} />
    </form>
  );
}
