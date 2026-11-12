"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Check, Copy, ExternalLink } from "lucide-react";
import {
  checkOwnerEmail,
  createRestaurantFull,
  type RestaurantCreationResult,
} from "../../actions";

type Plan = { id: string; name: string; price_cents: number; currency: string; is_active: boolean; plan_code: string | null };

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
  const pool    = upper + lower + digits + symbols;
  const bytes   = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const arr: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < 16; i++) arr.push(pool[bytes[i] % pool.length]);
  const sb = new Uint8Array(16);
  crypto.getRandomValues(sb);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = sb[i] % (i + 1);
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

// Step indicator — shows steps 1-3 (success is step 4, hidden from nav)
function WizardNav({ step }: { step: number }) {
  const steps = ["Identidad", "Propietario", "Plan"];
  const displayStep = Math.min(step, 3);
  return (
    <div className="wizard-nav">
      {steps.map((label, i) => {
        const num   = i + 1;
        const done  = displayStep > num;
        const active = displayStep === num;
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

// Copy-to-clipboard utility button
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      className="wiz-cred-copy"
      onClick={handleCopy}
      aria-label={`Copiar ${label ?? ""}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? " Copiado" : " Copiar"}
    </button>
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
  // emailVerified: false = initial, "new" = new user, "existing" = existing user
  const [ownerEmailInput, setOwnerEmailInput]   = useState("");
  const [ownerEmail, setOwnerEmail]             = useState(""); // confirmed email
  const [emailVerified, setEmailVerified]       = useState<false | "new" | "existing">(false);
  const [verifying, startVerifying]             = useTransition();
  const [verifyError, setVerifyError]           = useState<string | null>(null);
  const [ownerPwd, setOwnerPwd]                 = useState("");
  const [showPwd, setShowPwd]                   = useState(false);
  const [linkConfirmed, setLinkConfirmed]       = useState(false);

  // Step 3 state — default to "inicio" (free plan) if available
  const defaultPlanId = plans.find((p) => p.plan_code === "inicio")?.id ?? plans[0]?.id ?? "";
  const [planId, setPlanId] = useState<string>(defaultPlanId);

  // Step 4 (success) state
  const [successResult, setSuccessResult]       = useState<RestaurantCreationResult | null>(null);
  const [showSuccessPwd, setShowSuccessPwd]     = useState(false);

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

  function handleVerifyEmail() {
    const trimmed = ownerEmailInput.trim();
    if (!trimmed) { setVerifyError("Ingresa un correo."); return; }
    setVerifyError(null);
    startVerifying(async () => {
      const result = await checkOwnerEmail(trimmed);
      if (result.error) {
        setVerifyError(result.error);
        return;
      }
      setOwnerEmail(trimmed);
      setEmailVerified(result.exists ? "existing" : "new");
      setLinkConfirmed(false);
      setOwnerPwd("");
      setShowPwd(false);
    });
  }

  function handleChangeEmail() {
    setEmailVerified(false);
    setOwnerEmailInput(ownerEmail);
    setOwnerEmail("");
    setOwnerPwd("");
    setLinkConfirmed(false);
    setVerifyError(null);
  }

  function handleSkipOwner() {
    setOwnerEmail("");
    setOwnerEmailInput("");
    setOwnerPwd("");
    setEmailVerified(false);
    setLinkConfirmed(false);
    setError(null);
    setStep(3);
  }

  function validateStep2(): string | null {
    if (!ownerEmail) return null;
    if (emailVerified === "new") {
      if (!ownerPwd || ownerPwd.length < 8)
        return "La contraseña debe tener al menos 8 caracteres.";
    }
    if (emailVerified === "existing") {
      if (!linkConfirmed)
        return "Debes confirmar que quieres vincular esta cuenta.";
    }
    return null;
  }

  function handleStep2Next() {
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError(null);
    setStep(3);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name",           name);
      fd.set("slug",           slug);
      fd.set("currency",       currency);
      fd.set("timezone",       timezone);
      fd.set("business_type",  bizType);
      fd.set("orders_enabled", "true");
      if (ownerEmail) fd.set("owner_email", ownerEmail);
      // Only send password for new accounts
      if (ownerEmail && emailVerified === "new" && ownerPwd) {
        fd.set("owner_password", ownerPwd);
      }
      if (planId) fd.set("plan_id", planId);

      const result = await createRestaurantFull(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessResult(result);
        setStep(4);
      }
    });
  }

  function handleCreateAnother() {
    setStep(1);
    setError(null);
    setName("");
    setSlug("");
    setSlugEdited(false);
    setCurrency("USD");
    setTimezone("America/Caracas");
    setBizType("restaurant");
    setOwnerEmailInput("");
    setOwnerEmail("");
    setEmailVerified(false);
    setVerifyError(null);
    setOwnerPwd("");
    setShowPwd(false);
    setLinkConfirmed(false);
    setPlanId("");
    setSuccessResult(null);
    setShowSuccessPwd(false);
  }

  function handleGoToDetail() {
    if (successResult?.restaurantId) {
      router.push(`/admin/restaurants/${successResult.restaurantId}`);
    }
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
          {step < 4 && (
            <p className="panel-page-desc">
              Registra un nuevo negocio en la plataforma.{" "}
              <span style={{ color: "#94a3b8" }}>Paso {step} de 3</span>
            </p>
          )}
        </div>
      </div>

      <div className="panel-content">
        <div style={{ maxWidth: 560 }}>
          <div className="dashboard-card">
            {step < 4 && <WizardNav step={step} />}

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

            {/* ── Step 2: Owner access ── */}
            {step === 2 && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
                  Acceso del propietario (opcional)
                </h2>

                {/* Sub-state: initial — email not yet verified */}
                {emailVerified === false && (
                  <>
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Correo del propietario</label>
                      <input
                        type="email"
                        value={ownerEmailInput}
                        onChange={(e) => setOwnerEmailInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyEmail(); } }}
                        placeholder="propietario@ejemplo.com"
                        autoComplete="off"
                        disabled={verifying}
                      />
                    </div>

                    {verifyError && (
                      <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
                        {verifyError}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                      <button
                        type="button"
                        className="button small"
                        onClick={handleVerifyEmail}
                        disabled={verifying || !ownerEmailInput.trim()}
                      >
                        {verifying ? "Verificando…" : "Verificar correo"}
                      </button>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={handleSkipOwner}
                        disabled={verifying}
                      >
                        Asignar después
                      </button>
                    </div>

                    <span className="caption" style={{ display: "block" }}>
                      Puedes configurar el propietario después desde el detalle del negocio.
                    </span>
                  </>
                )}

                {/* Sub-state: new user */}
                {emailVerified === "new" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                      <Check size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#15803d", flex: 1, wordBreak: "break-all" }}>{ownerEmail}</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#667085", padding: "2px 4px", whiteSpace: "nowrap" }}
                        onClick={handleChangeEmail}
                      >
                        ← Cambiar correo
                      </button>
                    </div>

                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>
                        Contraseña inicial{" "}
                        <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div className="pwd-field-wrap">
                        <input
                          type={showPwd ? "text" : "password"}
                          value={ownerPwd}
                          onChange={(e) => setOwnerPwd(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
                          minLength={8}
                          required
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

                    <div style={{ marginBottom: 12 }}>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => { const p = generateSecurePassword(); setOwnerPwd(p); setShowPwd(true); }}
                      >
                        Generar contraseña segura
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "9px 12px", background: "#fffbeb", border: "1px solid #fde68a",
                        borderRadius: 7, fontSize: 12, color: "#92400e", marginBottom: 20,
                      }}
                    >
                      Esta es la contraseña inicial. Podrás copiarla al finalizar.
                    </div>
                  </>
                )}

                {/* Sub-state: existing user */}
                {emailVerified === "existing" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                      <Check size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#15803d", flex: 1, wordBreak: "break-all" }}>{ownerEmail}</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#667085", padding: "2px 4px", whiteSpace: "nowrap" }}
                        onClick={handleChangeEmail}
                      >
                        ← Cambiar correo
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "10px 14px", background: "#fffbeb",
                        border: "1px solid #fde68a", borderRadius: 8,
                        fontSize: 13, marginBottom: 16,
                      }}
                    >
                      Esta dirección ya tiene cuenta en Wacatalog. Se vinculará como propietario sin cambiar su contraseña ni afectar sus accesos actuales.
                    </div>

                    <label
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        cursor: "pointer", fontSize: 13, color: "#202337", marginBottom: 20,
                        minHeight: 44,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={linkConfirmed}
                        onChange={(e) => setLinkConfirmed(e.target.checked)}
                        style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }}
                      />
                      Confirmo que quiero vincular esta cuenta como propietaria de{" "}
                      <strong style={{ marginLeft: 4 }}>{name}</strong>
                    </label>
                  </>
                )}
              </>
            )}

            {/* ── Step 3: Plan ── */}
            {step === 3 && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#667085", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 20 }}>
                  Plan de suscripción
                </h2>

                <div className="field" style={{ marginBottom: 24 }}>
                  <label>Plan</label>
                  <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.price_cents === 0 ? " — Gratis" : ` — ${formatPrice(p.price_cents, p.currency)}/mes`}
                        {p.plan_code === "inicio" ? " (predeterminado)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="caption" style={{ marginTop: 4 }}>
                    Se asigna el plan Inicio (US$0) por defecto. Puedes cambiarlo después.
                  </span>
                </div>

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

            {/* ── Step 4: Success screen ── */}
            {step === 4 && successResult && (
              <div className="wiz-success">
                <div className="wiz-success-icon">✓</div>
                <h2 className="wiz-success-title">¡{successResult.restaurantName} creado!</h2>

                {successResult.owner && (
                  <div style={{ marginBottom: 8 }}>
                    {/* Email row */}
                    <div className="wiz-cred-row">
                      <span className="wiz-cred-label">Correo</span>
                      <span className="wiz-cred-value">{successResult.owner.email}</span>
                      <CopyButton value={successResult.owner.email} label="correo" />
                    </div>

                    {/* Login URL row */}
                    {successResult.loginUrl && (
                      <div className="wiz-cred-row">
                        <span className="wiz-cred-label">Acceso</span>
                        <span className="wiz-cred-value" title={successResult.loginUrl}>
                          {successResult.loginUrl}
                        </span>
                        <a
                          href={successResult.loginUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="wiz-cred-copy"
                          aria-label="Abrir enlace de acceso"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={11} />
                          Abrir
                        </a>
                        <CopyButton value={successResult.loginUrl} label="enlace de acceso" />
                      </div>
                    )}

                    {/* Password row — only for newly created accounts */}
                    {successResult.owner.method === "created" && ownerPwd && (
                      <>
                        <div className="wiz-cred-row">
                          <span className="wiz-cred-label">Contraseña</span>
                          <div className="wiz-pwd-field">
                            <span
                              className="wiz-cred-value"
                              style={{ fontFamily: "monospace" }}
                            >
                              {showSuccessPwd ? ownerPwd : "••••••••••••"}
                            </span>
                            <button
                              type="button"
                              className="wiz-pwd-toggle"
                              aria-label={showSuccessPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                              onClick={() => setShowSuccessPwd((v) => !v)}
                            >
                              {showSuccessPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <CopyButton value={ownerPwd} label="contraseña" />
                        </div>
                        <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6, marginBottom: 0, textAlign: "left" }}>
                          Copia la contraseña antes de cerrar. No se volverá a mostrar.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Linked account note */}
                {successResult.owner?.method === "linked" && (
                  <p style={{ fontSize: 13, color: "#667085", marginBottom: 16, textAlign: "left" }}>
                    La cuenta existente fue vinculada como propietaria.
                  </p>
                )}

                {/* Pending items */}
                {successResult.pendingItems && successResult.pendingItems.length > 0 && (
                  <div className="wiz-pending">
                    <p className="wiz-pending-title">Creado con advertencias:</p>
                    <ul>
                      {successResult.pendingItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                    <p style={{ marginTop: 8, marginBottom: 0, color: "#92400e" }}>
                      Puedes completar el acceso desde el detalle del negocio.
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
                  <button
                    type="button"
                    className="button small"
                    onClick={handleGoToDetail}
                  >
                    Ir al detalle del negocio
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={handleCreateAnother}
                  >
                    Crear otro negocio
                  </button>
                </div>
              </div>
            )}

            {/* ── Error (steps 1-3 only) ── */}
            {error && step < 4 && (
              <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* ── Navigation buttons ── */}
            {step === 1 && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" className="button small" onClick={handleNext}>
                  Siguiente
                </button>
                <Link href="/admin" className="button secondary small">
                  Cancelar
                </Link>
              </div>
            )}

            {step === 2 && emailVerified === false && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => { setError(null); setStep(1); }}
                >
                  Atrás
                </button>
              </div>
            )}

            {step === 2 && emailVerified !== false && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="button small"
                  onClick={handleStep2Next}
                  disabled={emailVerified === "existing" && !linkConfirmed}
                >
                  Siguiente
                </button>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => { setError(null); setStep(1); }}
                >
                  Atrás
                </button>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              </div>
            )}
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
