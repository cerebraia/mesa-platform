"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSaveConfig } from "../actions";

const TIMEZONES = [
  "America/Caracas", "America/Bogota", "America/Lima",
  "America/Santiago", "America/Mexico_City", "America/New_York",
  "America/Los_Angeles", "UTC",
];

type ConfigValues = {
  description?: string; primary_color?: string; background_color?: string;
  secondary_color?: string; font_family?: string;
  phone?: string; whatsapp?: string;
  instagram_url?: string; facebook_url?: string; twitter_url?: string;
  address?: string; pickup_enabled?: boolean; pickup_address?: string;
  pickup_notes?: string; delivery_enabled?: boolean;
  is_temporarily_closed?: boolean; closed_message?: string;
  orders_enabled?: boolean; seo_title?: string;
  seo_description?: string; allow_indexing?: boolean;
};

interface Props {
  restaurantId: string;
  restaurant:   { name: string; timezone: string; currency: string };
  config:       ConfigValues;
}

export function ConfigAdminForm({ restaurantId, restaurant, config }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await adminSaveConfig(restaurantId, fd);
      if (res.error) setError(res.error);
      else { setSaved(true); router.refresh(); }
    });
  }

  const field = (label: string, name: string, type = "text", placeholder = "") => (
    <div className="field" style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13 }}>{label}</label>
      <input name={name} type={type} defaultValue={String(config[name as keyof ConfigValues] ?? "")} placeholder={placeholder} />
    </div>
  );

  const toggle = (label: string, name: string, desc?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "#667085" }}>{desc}</div>}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input name={name} type="checkbox" defaultChecked={!!config[name as keyof ConfigValues]} />
        <span style={{ fontSize: 12 }}>Activado</span>
      </label>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {/* Identity */}
      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".5px", color: "#667085", marginBottom: 16 }}>
          Identidad
        </h2>
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13 }}>Nombre del negocio</label>
          <input name="name" type="text" required defaultValue={restaurant.name} />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13 }}>Descripción</label>
          <textarea name="description" rows={3}
            defaultValue={config.description ?? ""}
            style={{ resize: "vertical" }} />
        </div>
        {field("Teléfono", "phone", "tel")}
        {field("WhatsApp", "whatsapp", "tel")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {field("Instagram", "instagram_url", "url")}
          {field("Facebook",  "facebook_url",  "url")}
          {field("Twitter/X", "twitter_url",   "url")}
        </div>
        {field("Color principal", "primary_color", "color")}
      </div>

      {/* Operations */}
      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".5px", color: "#667085", marginBottom: 16 }}>
          Operación
        </h2>
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13 }}>Zona horaria</label>
          <select name="timezone" defaultValue={restaurant.timezone}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        {field("Dirección", "address")}
        {toggle("Retiro en local", "pickup_enabled")}
        {field("Dirección de retiro", "pickup_address")}
        {toggle("Delivery habilitado", "delivery_enabled")}
        {toggle("Pedidos habilitados", "orders_enabled", "Desactivar esconde el botón de pedido")}
        {toggle("Cierre temporal", "is_temporarily_closed")}
        {field("Mensaje de cierre", "closed_message")}
      </div>

      {/* SEO */}
      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".5px", color: "#667085", marginBottom: 16 }}>
          SEO
        </h2>
        {field("Título SEO", "seo_title")}
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13 }}>Descripción SEO</label>
          <textarea name="seo_description" rows={2}
            defaultValue={config.seo_description ?? ""}
            style={{ resize: "vertical" }} />
        </div>
        {toggle("Permitir indexación", "allow_indexing", "Habilita que buscadores indexen el catálogo")}
      </div>

      {error && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>
      )}
      {saved && (
        <div style={{ padding: "10px 14px", background: "#F0FDF4", border: "1px solid #86EFAC",
          borderRadius: 8, fontSize: 13, color: "#166534", marginBottom: 12 }}>
          Configuración guardada.
        </div>
      )}

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}
