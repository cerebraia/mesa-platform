"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, RefreshCw, Check } from "lucide-react";
import { createRestaurantWithConfig } from "../../actions";

type Plan = { id: string; name: string; price_cents: number; currency: string; is_active: boolean };

const TIMEZONES = [
  "America/Caracas",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function generateSecurePassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const symbols = "!@#$%^&*";
  const all     = upper + lower + digits + symbols;
  const arr     = Array.from({ length: 16 }, (_, i) => {
    if (i === 0) return upper[Math.floor(Math.random() * upper.length)];
    if (i === 1) return lower[Math.floor(Math.random() * lower.length)];
    if (i === 2) return digits[Math.floor(Math.random() * digits.length)];
    if (i === 3) return symbols[Math.floor(Math.random() * symbols.length)];
    return all[Math.floor(Math.random() * all.length)];
  });
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency", currency, minimumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

// Step indicator
function WizardNav({ step }: { step: number }) {
  const steps = ["Identidad", "Propietario", "Plan"];
  return (
    <div className="wizard-nav">
      {steps.map((label, i) => {
        const num   = i + 1;
        const done  = step > num;
        const active = step === num;
        return (
          <div
            key={label}
            className={
              "wizard-step" +
              (done ? " wizard-step--done" : "") +
              (active ? " wizard-step--active" : "")
            }
          >
            <span className="wizard-step-num">
              {done ? <Check size={14} /> : num}
            </span>
            <span className="wizard-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function NewRestaurantWizard({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [name, setName]             = useState("");
  const [slug, setSlug]             = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency]     = useState("USD");
  const [timezone, setTimezone]     = useState("America/Caracas");
  const [bizType, setBizType]       = useState("restaurant");

  // Step 2 state
  const [ownerEmail, setOwnerEmail]   = useState("");
  const [ownerPwd, setOwnerPwd]       = useState("");
  const [showPwd, setShowPwd]         = useState(false);

  // Step 3 state
  const [planId, setPlanId] = useState<string>("");

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setSlugEdited(true);
  }

  function validateStep1(): string | null {
    if (!name.trim() || name.trim().length < 2)
      return "El nombre debe tener al menos 2 caracteres.";
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug))
      return "El slug solo puede tener minúsculas, dígitos y guiones (3–63 chars).";
    if (currency.length !== 3)
      return "Moneda inválida.";
    return null;
  }

  function handleNext() {
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name",          name);
      fd.set("slug",          slug);
      fd.set("currency",      currency);
      fd.set("timezone",      timezone);
      fd.set("business_type", bizType);
      fd.set("orders_enabled", "true");
      if (ownerEmail) fd.set("owner_email",    ownerEmail);
      if (ownerPwd)   fd.set("owner_password", ownerPwd);
      if (planId)     fd.set("plan_id",        planId);

      const result = await createRestaurantWithConfig(fd);
      if (result.error) {
        setError(result.error);
      } else {
        const id = (result.data as Record<string, string>).id;
        const warning = (result.data as Record<string, unknown>).warning as string | null;
        if (warning) {
          // Navigate but show warning via URL param (non-critical)
          router.push(`/admin/restaurants/${id}?warn=${encodeURIComponent(warning)}`);
        } else {
          router.push(`/admin/restaurants/${id}`);
        }
      }
    });
  }

  return (
    <>
      <div className="panel-page-header">
        <div>
          <div className="panel-breadcrumb">
            <Link href="/admin" className="panel-breadcrumb-link">
              <ArrowLeft size={13} />
              Negocios
            </Link>
          </div>
          <h1 className="panel-page-title">Nuevo negocio</h1>
          <p className="panel-page-desc">
            Registra un nuevo negocio en la plataforma.{" "}
            <span style={{ color: "#94a3b8" }}>Paso {step} de 3</span>
          </p>
        </div>
      </div>

      <div className="panel-content">
        <div style={{ maxWidth: 560 }}>
          <div className="dashboard-card">
            <WizardNav step={step} />

            {/* ── Step 1: Identity ── */}
            {step === 1 && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
                  Identidad del negocio
                </h2>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Nombre del negocio</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej. Restaurante Ejemplo"
                  />
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Slug (URL pública)</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={63}
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="restaurante-ejemplo"
                  />
                  {slug && (
                    <span className="caption" style={{ marginTop: 6, display: "block" }}>
                      URL del catálogo: <strong>https://{slug}.wacatalogo.com/</strong>
                    </span>
                  )}
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Tipo de negocio</label>
                  <select value={bizType} onChange={(e) => setBizType(e.target.value)}>
                    <option value="restaurant">Restaurante</option>
                    <option value="store">Tienda</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                  <div className="field">
                    <label>Moneda</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="USD">USD — Dólar</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="VES">VES — Bolívar</option>
                      <option value="COP">COP — Peso colombiano</option>
                      <option value="MXN">MXN — Peso mexicano</option>
                      <option value="PEN">PEN — Sol peruano</option>
                      <option value="GBP">GBP — Libra</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Zona horaria</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Owner ── */}
            {step === 2 && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
                  Propietario (opcional)
                </h2>

                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Correo del dueño</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@ejemplo.com"
                    autoComplete="off"
                  />
                </div>

                <div className="field" style={{ marginBottom: 4 }}>
                  <label>Contraseña (opcional)</label>
                  <div className="pwd-field-wrap">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={ownerPwd}
                      onChange={(e) => setOwnerPwd(e.target.value)}
                      placeholder="Dejar vacío para enviar invitación"
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="pwd-field-toggle"
                      aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => setShowPwd((v) => !v)}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => { const p = generateSecurePassword(); setOwnerPwd(p); setShowPwd(true); }}
                  >
                    <RefreshCw size={13} style={{ marginRight: 4 }} />
                    Generar contraseña segura
                  </button>
                </div>

                <span className="caption" style={{ display: "block", marginBottom: 24 }}>
                  Si dejas la contraseña vacía, se envía invitación por correo.
                  Puedes configurar el propietario después desde el detalle del negocio.
                </span>
              </>
            )}

            {/* ── Step 3: Plan ── */}
            {step === 3 && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
                  Plan de suscripción (opcional)
                </h2>

                <div className="field" style={{ marginBottom: 24 }}>
                  <label>Plan</label>
                  <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                    <option value="">Sin plan — modo onboarding libre</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price_cents, p.currency)}/mes
                      </option>
                    ))}
                  </select>
                </div>

                {!planId && (
                  <div
                    style={{
                      padding: "10px 14px", background: "#fffbeb",
                      border: "1px solid #fde68a", borderRadius: 8,
                      fontSize: 12, marginBottom: 20,
                    }}
                  >
                    El negocio se creará en modo onboarding sin suscripción activa.
                    Podrás asignar un plan después desde el detalle del negocio.
                  </div>
                )}

                {/* Summary */}
                <div
                  style={{
                    padding: "14px 16px", background: "#f8f9ff",
                    border: "1px solid #E8E9EF", borderRadius: 10, marginBottom: 24,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
                    Resumen
                  </p>
                  <div style={{ display: "grid", gap: 4 }}>
                    <Row label="Nombre"    value={name} />
                    <Row label="Slug"      value={slug} />
                    <Row label="Moneda"    value={currency} />
                    <Row label="Zona"      value={timezone} />
                    <Row label="Tipo"      value={bizType} />
                    {ownerEmail && <Row label="Dueño"  value={ownerEmail} />}
                    {planId && (
                      <Row
                        label="Plan"
                        value={plans.find((p) => p.id === planId)?.name ?? planId}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* ── Navigation buttons ── */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {step < 3 && (
                <>
                  <button type="button" className="button small" onClick={handleNext}>
                    Siguiente
                  </button>
                  {step === 2 && (
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => { setOwnerEmail(""); setOwnerPwd(""); setError(null); setStep(3); }}
                    >
                      Saltar este paso
                    </button>
                  )}
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => { setError(null); setStep((s) => s - 1); }}
                    style={{ display: step === 1 ? "none" : undefined }}
                  >
                    Atrás
                  </button>
                  {step === 1 && (
                    <Link href="/admin" className="button secondary small">
                      Cancelar
                    </Link>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <button
                    type="button"
                    className="button small"
                    disabled={pending}
                    onClick={handleSubmit}
                  >
                    {pending ? "Creando…" : "Crear negocio"}
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => { setError(null); setStep(2); }}
                  >
                    Atrás
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
      <span style={{ color: "#94a3b8", minWidth: 60 }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#202337" }}>{value}</span>
    </div>
  );
}
