"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { saveConfig, saveConfigImage, type ConfigState } from "./actions";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import type { RestaurantConfig } from "@/lib/catalog-types";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button">
      {pending ? "Guardando…" : label}
    </button>
  );
}

interface Props {
  restaurant: { id: string; name: string; slug: string; timezone: string };
  config?: RestaurantConfig;
  timezones: string[];
  supabaseUrl: string;
  restaurantId: string;
}

const ASSET_BASE = (url: string) =>
  `${url}/storage/v1/object/public/restaurant-assets`;

function detectImageType(b: Uint8Array): boolean {
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

export function ConfigForm({ restaurant, config, timezones, supabaseUrl, restaurantId }: Props) {
  const initial: ConfigState = { error: null };
  const [state, action] = useActionState(saveConfig, initial);
  const [isPending, startTransition] = useTransition();
  const [imgError, setImgError] = useState<string | null>(null);
  const { setDirty } = useUnsavedChanges();

  // Save succeeded (success: true) → clear guard
  useEffect(() => {
    if (state.success) setDirty(false);
  }, [state.success, setDirty]);

  // Save failed → restore guard
  useEffect(() => {
    if (state.error) setDirty(true);
  }, [state.error, setDirty]);

  async function uploadImage(file: File, type: "logo" | "cover") {
    if (file.size > 5 * 1024 * 1024) { setImgError("La imagen supera 5 MB."); return; }
    const buf = await file.arrayBuffer();
    const hdr = new Uint8Array(buf.slice(0, 12));
    if (!detectImageType(hdr)) { setImgError("Formato no válido. Usa JPEG, PNG o WebP."); return; }
    setImgError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("restaurant_id", restaurantId);
    fd.append("type", type);

    startTransition(async () => {
      const res = await fetch("/api/menu/upload", { method: "POST", body: fd });
      const json = await res.json() as { path?: string; error?: string };
      if (!res.ok || json.error) { setImgError(json.error ?? "Error al subir imagen."); return; }
      const result = await saveConfigImage(`${type}_path`, json.path!);
      if (result.error) setImgError(result.error);
      else window.location.reload();
    });
  }

  const logoUrl = config?.logo_path ? `${ASSET_BASE(supabaseUrl)}/${config.logo_path}` : null;
  const coverUrl = config?.cover_path ? `${ASSET_BASE(supabaseUrl)}/${config.cover_path}` : null;

  return (
    <form action={action} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      {/* ── Identidad ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--muted)", letterSpacing: 1 }}>IDENTIDAD</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="cf-name">Nombre del negocio *</label>
          <input id="cf-name" name="name" type="text" maxLength={100} required defaultValue={restaurant.name} />
        </div>
        <div className="field">
          <label htmlFor="cf-slug">
            Slug (solo lectura)
            <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>Cambiar puede romper enlaces</span>
          </label>
          <input id="cf-slug" value={restaurant.slug} readOnly style={{ background: "var(--bg)", cursor: "not-allowed" }} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cf-desc">Descripción breve</label>
        <input id="cf-desc" name="description" type="text" maxLength={300} defaultValue={config?.description ?? ""} placeholder="Ej: Hamburguesas artesanales. Abrimos a las 11:00." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="cf-phone">Teléfono</label>
          <input id="cf-phone" name="phone" type="tel" maxLength={30} defaultValue={config?.phone ?? ""} placeholder="+58 412 000 0000" />
        </div>
        <div className="field">
          <label htmlFor="cf-wa">WhatsApp</label>
          <input id="cf-wa" name="whatsapp" type="tel" maxLength={30} defaultValue={config?.whatsapp ?? ""} placeholder="+58 412 000 0000" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="cf-ig">Instagram URL</label>
          <input id="cf-ig" name="instagram_url" type="url" maxLength={200} defaultValue={config?.instagram_url ?? ""} placeholder="https://instagram.com/..." />
        </div>
        <div className="field">
          <label htmlFor="cf-fb">Facebook URL</label>
          <input id="cf-fb" name="facebook_url" type="url" maxLength={200} defaultValue={config?.facebook_url ?? ""} placeholder="https://facebook.com/..." />
        </div>
        <div className="field">
          <label htmlFor="cf-tw">Twitter / X URL</label>
          <input id="cf-tw" name="twitter_url" type="url" maxLength={200} defaultValue={config?.twitter_url ?? ""} placeholder="https://twitter.com/..." />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
        <div className="field">
          <label>Color principal del menú</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input name="primary_color" type="color" defaultValue={config?.primary_color ?? "#703BE6"} style={{ width: 48, height: 36, padding: 2, borderRadius: 6 }} />
            <span className="muted" style={{ fontSize: 12 }}>Se aplicará al menú público</span>
          </div>
        </div>
      </div>

      {/* ── Logo y portada ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Logo</div>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={isPending}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "logo"); }} style={{ fontSize: 12 }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Portada</div>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada" style={{ width: "100%", maxWidth: 200, height: 64, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={isPending}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "cover"); }} style={{ fontSize: 12 }} />
        </div>
      </div>
      {imgError && <p className="auth-error">{imgError}</p>}

      {/* ── Operación ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "24px 0 16px", color: "var(--muted)", letterSpacing: 1 }}>OPERACIÓN</h3>

      <div className="field">
        <label htmlFor="cf-tz">Zona horaria *</label>
        <select id="cf-tz" name="timezone" defaultValue={restaurant.timezone} required>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cf-addr">Dirección del local</label>
        <input id="cf-addr" name="address" type="text" maxLength={300} defaultValue={config?.address ?? ""} placeholder="Av. Principal, Local 5, Caracas" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input type="hidden" name="pickup_enabled" value="false" />
            <input id="cf-pickup" type="checkbox" name="pickup_enabled" value="true" defaultChecked={config?.pickup_enabled ?? false} style={{ width: 16, height: 16, accentColor: "var(--purple)" }} />
            <label htmlFor="cf-pickup" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Retiro en local habilitado</label>
          </div>
          <div className="field">
            <label htmlFor="cf-pickup-addr">Dirección de retiro</label>
            <input id="cf-pickup-addr" name="pickup_address" type="text" maxLength={300} defaultValue={config?.pickup_address ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="cf-pickup-notes">Instrucciones de retiro</label>
            <input id="cf-pickup-notes" name="pickup_notes" type="text" maxLength={500} defaultValue={config?.pickup_notes ?? ""} placeholder="Ej: Preguntar por Juan en caja" />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input type="hidden" name="delivery_enabled" value="false" />
            <input id="cf-delivery" type="checkbox" name="delivery_enabled" value="true" defaultChecked={config?.delivery_enabled ?? false} style={{ width: 16, height: 16, accentColor: "var(--purple)" }} />
            <label htmlFor="cf-delivery" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Delivery habilitado</label>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Configura las zonas en la sección de abajo.</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "var(--soft)", borderRadius: 8, margin: "16px 0" }}>
        <input type="hidden" name="is_temporarily_closed" value="false" />
        <input id="cf-closed" type="checkbox" name="is_temporarily_closed" value="true" defaultChecked={config?.is_temporarily_closed ?? false} style={{ width: 16, height: 16, accentColor: "var(--purple)" }} />
        <label htmlFor="cf-closed" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Cierre temporal manual</label>
      </div>
      <div className="field">
        <label htmlFor="cf-closed-msg">Mensaje de cierre</label>
        <input id="cf-closed-msg" name="closed_message" type="text" maxLength={200} defaultValue={config?.closed_message ?? ""} placeholder="Ej: Volvemos mañana a las 11:00" />
      </div>

      {/* ── Modalidad del catálogo ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "28px 0 14px", color: "var(--muted)", letterSpacing: 1 }}>MODALIDAD DEL CATÁLOGO</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* hidden default para submit sin interacción */}
        <input type="hidden" name="orders_enabled" value="false" />

        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--bg)", borderRadius: 10, border: "1.5px solid var(--border)", cursor: "pointer" }}>
          <input
            type="radio"
            name="orders_enabled"
            value="false"
            defaultChecked={!(config?.orders_enabled ?? true)}
            style={{ marginTop: 2, accentColor: "var(--purple)", width: 16, height: 16, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Solo catálogo</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
              Los clientes exploran los productos y pueden consultar por WhatsApp. Sin carrito ni pedidos en línea.
            </div>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--bg)", borderRadius: 10, border: "1.5px solid var(--border)", cursor: "pointer" }}>
          <input
            type="radio"
            name="orders_enabled"
            value="true"
            defaultChecked={config?.orders_enabled ?? true}
            style={{ marginTop: 2, accentColor: "var(--purple)", width: 16, height: 16, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Catálogo con pedidos</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
              Los clientes pueden añadir productos al carrito y enviar pedidos en línea. Requiere zonas de delivery o retiro configurados.
            </div>
          </div>
        </label>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        Cambiar la modalidad no borra el historial de pedidos. Los pedidos existentes permanecen accesibles.
      </p>

      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p style={{ color: "#2e7d32", fontSize: 13, padding: "8px 14px", background: "#e8f5e9", borderRadius: 8, marginBottom: 12 }}>Configuración guardada.</p>}

      <SaveButton label="Guardar configuración" />
    </form>
  );
}
