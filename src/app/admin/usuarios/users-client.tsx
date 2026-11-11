"use client";

import { useState, useTransition, useMemo } from "react";
import { Check, Copy, Eye, EyeOff, X } from "lucide-react";
import {
  checkOwnerEmail,
  createUserMembership,
  updateMembershipRole,
  revokeMembership,
  setOwnerPassword,
} from "../actions";

// ── Types ─────────────────────────────────────────────────────

type Membership = {
  membershipId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: string;
  status: string;
};

type UserRow = {
  userId: string;
  email: string;
  createdAt: string;
  memberships: Membership[];
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
};

type MemberRole = "owner" | "attention" | "kitchen";

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  attention: "Atención",
  kitchen: "Cocina",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  invited: "Invitado",
  suspended: "Suspendido",
};

// ── Utilities ─────────────────────────────────────────────────

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

// ── CopyButton ────────────────────────────────────────────────

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

// ── InlineRoleSelect ──────────────────────────────────────────

function InlineRoleSelect({
  membershipId,
  currentRole,
  onDone,
}: {
  membershipId: string;
  currentRole: string;
  onDone: (newRole: string) => void;
}) {
  const [role, setRole] = useState(currentRole as MemberRole);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(newRole: MemberRole) {
    if (newRole === currentRole) return;
    if (!confirm(`¿Cambiar el rol a "${ROLE_LABEL[newRole]}"?`)) return;
    setRole(newRole);
    setError(null);
    startTransition(async () => {
      const res = await updateMembershipRole(membershipId, newRole);
      if (res.error) {
        setError(res.error);
        setRole(currentRole as MemberRole);
      } else {
        onDone(newRole);
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as MemberRole)}
        disabled={pending}
        style={{ fontSize: 11, padding: "2px 4px", minWidth: 90 }}
        aria-label="Cambiar rol"
      >
        <option value="owner">Propietario</option>
        <option value="attention">Atención</option>
        <option value="kitchen">Cocina</option>
      </select>
      {error && <span style={{ fontSize: 10, color: "#ef4444" }}>{error}</span>}
    </span>
  );
}

// ── RevokeButton ──────────────────────────────────────────────

function RevokeButton({
  membershipId,
  role,
  onDone,
}: {
  membershipId: string;
  role: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRevoke() {
    if (
      !confirm(
        "¿Revocar esta membresía? El usuario perderá acceso a este negocio (se suspenderá, no se eliminará).",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await revokeMembership(membershipId);
      if (res.lastOwnerBlocked) {
        setError("No se puede revocar: es el único propietario activo.");
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <button
        type="button"
        className="chip-btn"
        onClick={handleRevoke}
        disabled={pending}
        title="Revocar membresía"
        aria-label={`Revocar membresía (${ROLE_LABEL[role] ?? role})`}
      >
        {pending ? "…" : "✕"}
      </button>
      {error && (
        <span
          style={{
            fontSize: 10,
            color: "#ef4444",
            maxWidth: 160,
            lineHeight: 1.3,
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
}

// ── MembershipChip ────────────────────────────────────────────

function MembershipChip({
  membership,
  onRoleChange,
  onRevoke,
}: {
  membership: Membership;
  onRoleChange: (membershipId: string, newRole: string) => void;
  onRevoke: (membershipId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isSuspended = membership.status === "suspended";

  const chipClass =
    "membership-chip" +
    ` membership-chip--${membership.role}` +
    (isSuspended ? " membership-chip--suspended" : "");

  return (
    <span className={chipClass}>
      <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
        {membership.restaurantName}
      </span>
      <span style={{ opacity: 0.7 }}>·</span>
      {editing ? (
        <>
          <InlineRoleSelect
            membershipId={membership.membershipId}
            currentRole={membership.role}
            onDone={(newRole) => {
              onRoleChange(membership.membershipId, newRole);
              setEditing(false);
            }}
          />
          <button
            type="button"
            className="chip-btn"
            onClick={() => setEditing(false)}
            title="Cancelar"
            aria-label="Cancelar edición de rol"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span>{ROLE_LABEL[membership.role] ?? membership.role}</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ opacity: 0.75 }}>{STATUS_LABEL[membership.status] ?? membership.status}</span>
          {!isSuspended && (
            <span className="chip-actions">
              <button
                type="button"
                className="chip-btn"
                onClick={() => setEditing(true)}
                title="Cambiar rol"
                aria-label={`Cambiar rol en ${membership.restaurantName}`}
              >
                ✎
              </button>
              <RevokeButton
                membershipId={membership.membershipId}
                role={membership.role}
                onDone={() => onRevoke(membership.membershipId)}
              />
            </span>
          )}
        </>
      )}
    </span>
  );
}

// ── Change Password Modal ─────────────────────────────────────

function ChangePasswordModal({
  userId,
  email,
  onClose,
}: {
  userId: string;
  email: string;
  onClose: () => void;
}) {
  const [pwd, setPwd]               = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [done, setDone]             = useState(false);

  function handleClose() {
    setPwd("");
    setConfirmPwd("");
    onClose();
  }

  function handleGenerate() {
    const p = generateSecurePassword();
    setPwd(p);
    setConfirmPwd(p);
    setShowPwd(true);
    setError(null);
  }

  function handleSubmit() {
    if (!pwd)               { setError("Ingresa una contraseña.");                         return; }
    if (pwd.length < 8)     { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (pwd !== confirmPwd) { setError("Las contraseñas no coinciden.");                   return; }
    setError(null);
    startTransition(async () => {
      const res = await setOwnerPassword(userId, pwd);
      if (res.error) {
        setError(res.error);
      } else {
        setPwd("");
        setConfirmPwd("");
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <div className="usr-modal-bg" role="dialog" aria-modal="true" aria-labelledby="cpwd-title">
        <div className="usr-modal">
          <div className="usr-modal-header">
            <h2 className="usr-modal-title" id="cpwd-title">Contraseña actualizada</h2>
            <button className="usr-modal-close" onClick={handleClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          <div className="wiz-success">
            <div className="wiz-success-icon">✓</div>
            <p style={{ fontSize: 14, color: "#374151", margin: "0 0 10px" }}>
              La contraseña de <strong>{email}</strong> se actualizó correctamente.
            </p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 24px", lineHeight: 1.5 }}>
              Las sesiones activas quedan invalidadas inmediatamente.
              El usuario deberá iniciar sesión de nuevo con la nueva contraseña.
            </p>
            <button type="button" className="button small" onClick={handleClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="usr-modal-bg" role="dialog" aria-modal="true" aria-labelledby="cpwd-title">
      <div className="usr-modal">
        <div className="usr-modal-header">
          <h2 className="usr-modal-title" id="cpwd-title">Cambiar contraseña</h2>
          <button className="usr-modal-close" onClick={handleClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Account identifier — always visible so the admin knows which account they're modifying */}
        <div
          style={{
            marginBottom: 20, padding: "12px 14px",
            background: "#F9FAFB", border: "1px solid #E8E9EF", borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 11, color: "#667085", display: "block", marginBottom: 4 }}>
            Cuenta
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#202337", wordBreak: "break-all" }}>
            {email}
          </span>
        </div>

        {/* New password */}
        <div className="field" style={{ marginBottom: 8 }}>
          <label>
            Nueva contraseña <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div className="pwd-field-wrap">
            <input
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(null); }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
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

        {/* Confirm */}
        <div className="field" style={{ marginBottom: 8 }}>
          <label>
            Confirmar contraseña <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div className="pwd-field-wrap">
            <input
              type={showConf ? "text" : "password"}
              value={confirmPwd}
              onChange={(e) => { setConfirmPwd(e.target.value); setError(null); }}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="pwd-field-toggle"
              aria-label={showConf ? "Ocultar confirmación" : "Mostrar confirmación"}
              onClick={() => setShowConf((v) => !v)}
            >
              {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Generate + copy */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="button secondary small" onClick={handleGenerate}>
            Generar contraseña segura
          </button>
          {pwd && <CopyButton value={pwd} label="contraseña generada" />}
        </div>

        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="button"
            style={{ minWidth: 160 }}
            onClick={handleSubmit}
            disabled={pending || !pwd || !confirmPwd}
          >
            {pending ? "Guardando…" : "Guardar contraseña"}
          </button>
          <button
            type="button"
            className="button secondary small"
            onClick={handleClose}
            disabled={pending}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────

type ModalStep = "email" | "details" | "success";

type SuccessData = {
  email: string;
  restaurantName: string;
  role: string;
  loginUrl: string;
  method: "created" | "linked";
  password?: string;
};

function CreateUserModal({
  restaurants,
  onClose,
  onCreated,
}: {
  restaurants: Restaurant[];
  onClose: () => void;
  onCreated: (user: UserRow) => void;
}) {
  const [step, setStep] = useState<ModalStep>("email");

  // Step A — email
  const [emailInput, setEmailInput] = useState("");
  const [emailState, setEmailState] = useState<false | "new" | "existing">(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verifying, startVerifying] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Step B — details
  const [restaurantId, setRestaurantId] = useState(
    restaurants.length > 0 ? restaurants[0].id : "",
  );
  const [role, setRole] = useState<MemberRole>("owner");

  // Step C — password (new users only)
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // already-member info
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [existingRole, setExistingRole] = useState("");
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);

  // Submission
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [showSuccessPwd, setShowSuccessPwd] = useState(false);

  function handleVerifyEmail() {
    const trimmed = emailInput.trim();
    if (!trimmed) { setVerifyError("Ingresa un correo."); return; }
    setVerifyError(null);
    startVerifying(async () => {
      const res = await checkOwnerEmail(trimmed);
      if (res.error) { setVerifyError(res.error); return; }
      setVerifiedEmail(trimmed);
      setEmailState(res.exists ? "existing" : "new");
      setPassword("");
      setShowPwd(false);
      setAlreadyMember(false);
      setExistingRole("");
      setConfirmRoleChange(false);
    });
  }

  function handleChangeEmail() {
    setEmailInput(verifiedEmail);
    setVerifiedEmail("");
    setEmailState(false);
    setVerifyError(null);
    setPassword("");
    setAlreadyMember(false);
    setExistingRole("");
    setConfirmRoleChange(false);
  }

  function handleNext() {
    if (emailState === false) { setVerifyError("Verifica el correo primero."); return; }
    if (!restaurantId) { setSubmitError("Selecciona un negocio."); return; }
    if (emailState === "new" && (!password || password.length < 8)) {
      setSubmitError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSubmitError(null);
    setAlreadyMember(false);
    setExistingRole("");
    setConfirmRoleChange(false);
    setStep("details");
  }

  function handleSubmit() {
    setSubmitError(null);
    if (alreadyMember && !confirmRoleChange) {
      setSubmitError("Confirma que deseas cambiar el rol de esta membresía existente.");
      return;
    }
    startSubmit(async () => {
      const res = await createUserMembership({
        email: verifiedEmail,
        restaurantId,
        role,
        password: emailState === "new" ? password : undefined,
      });

      if (res.error) {
        setSubmitError(res.error);
        return;
      }

      if (res.alreadyMember) {
        setAlreadyMember(true);
        setExistingRole(res.existingRole ?? "");
        return;
      }

      const rest = restaurants.find((r) => r.id === restaurantId);
      setSuccess({
        email: verifiedEmail,
        restaurantName: rest?.name ?? restaurantId,
        role,
        loginUrl: res.loginUrl ?? "",
        method: res.method ?? "linked",
        password: res.method === "created" ? password : undefined,
      });
      setPassword(""); // clear password from state after success
      setStep("success");

      // Notify parent so it can refresh
      onCreated({
        userId: res.userId ?? "",
        email: verifiedEmail,
        createdAt: new Date().toISOString(),
        memberships: [
          {
            membershipId: res.membershipId ?? "",
            restaurantId,
            restaurantName: rest?.name ?? "",
            restaurantSlug: rest?.slug ?? "",
            role,
            status: "active",
          },
        ],
      });
    });
  }

  return (
    <div className="usr-modal-bg" role="dialog" aria-modal="true" aria-labelledby="usr-modal-title">
      <div className="usr-modal">
        <div className="usr-modal-header">
          <h2 className="usr-modal-title" id="usr-modal-title">
            {step === "success" ? "Usuario creado" : "Crear usuario"}
          </h2>
          <button
            type="button"
            className="usr-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Success screen ── */}
        {step === "success" && success && (
          <div className="wiz-success">
            <div className="wiz-success-icon">✓</div>
            <h3 className="wiz-success-title" style={{ fontSize: 16 }}>
              {success.method === "created" ? "Usuario creado y vinculado" : "Usuario vinculado"}
            </h3>

            <div className="wiz-cred-row">
              <span className="wiz-cred-label">Correo</span>
              <span className="wiz-cred-value">{success.email}</span>
              <CopyButton value={success.email} label="correo" />
            </div>

            <div className="wiz-cred-row">
              <span className="wiz-cred-label">Negocio</span>
              <span className="wiz-cred-value">{success.restaurantName}</span>
            </div>

            <div className="wiz-cred-row">
              <span className="wiz-cred-label">Rol</span>
              <span className="wiz-cred-value">{ROLE_LABEL[success.role] ?? success.role}</span>
            </div>

            {success.loginUrl && (
              <div className="wiz-cred-row">
                <span className="wiz-cred-label">Acceso</span>
                <span className="wiz-cred-value" title={success.loginUrl}>
                  {success.loginUrl}
                </span>
                <CopyButton value={success.loginUrl} label="enlace de acceso" />
              </div>
            )}

            {success.method === "created" && success.password && (
              <>
                <div className="wiz-cred-row">
                  <span className="wiz-cred-label">Contraseña</span>
                  <div className="wiz-pwd-field">
                    <span className="wiz-cred-value" style={{ fontFamily: "monospace" }}>
                      {showSuccessPwd ? success.password : "••••••••••••"}
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
                  <CopyButton value={success.password} label="contraseña" />
                </div>
                <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6, textAlign: "left" }}>
                  Copia la contraseña antes de cerrar. No se volverá a mostrar.
                </p>
              </>
            )}

            <button
              type="button"
              className="button small"
              onClick={onClose}
              style={{ marginTop: 20 }}
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ── Step email ── */}
        {step === "email" && (
          <>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Correo electrónico</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyEmail(); } }}
                placeholder="usuario@ejemplo.com"
                autoComplete="off"
                disabled={verifying || emailState !== false}
              />
            </div>

            {verifyError && (
              <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
                {verifyError}
              </div>
            )}

            {/* Verified state banner */}
            {emailState !== false && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                  padding: "10px 12px",
                  background: emailState === "new" ? "#f0fdf4" : "#eff6ff",
                  border: `1px solid ${emailState === "new" ? "#bbf7d0" : "#bfdbfe"}`,
                  borderRadius: 8,
                }}
              >
                <Check size={14} style={{ color: emailState === "new" ? "#16a34a" : "#1d4ed8", flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, wordBreak: "break-all" }}>
                  {emailState === "new" ? "Correo disponible — se creará una cuenta nueva" : "Cuenta existente — se vinculará al negocio"}
                </span>
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#667085", padding: "2px 4px" }}
                  onClick={handleChangeEmail}
                >
                  ← Cambiar
                </button>
              </div>
            )}

            {emailState === false && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  className="button small"
                  onClick={handleVerifyEmail}
                  disabled={verifying || !emailInput.trim()}
                >
                  {verifying ? "Verificando…" : "Verificar correo"}
                </button>
              </div>
            )}

            {emailState !== false && (
              <>
                {/* Business + Role selectors */}
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Negocio</label>
                  <select
                    value={restaurantId}
                    onChange={(e) => {
                      setRestaurantId(e.target.value);
                      setAlreadyMember(false);
                      setExistingRole("");
                      setConfirmRoleChange(false);
                    }}
                  >
                    {restaurants.length === 0 && (
                      <option value="">Sin negocios disponibles</option>
                    )}
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Rol</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                    <option value="owner">Propietario</option>
                    <option value="attention">Atención</option>
                    <option value="kitchen">Cocina</option>
                  </select>
                </div>

                {/* Password field for new users */}
                {emailState === "new" && (
                  <>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>
                        Contraseña inicial <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div className="pwd-field-wrap">
                        <input
                          type={showPwd ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
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
                        onClick={() => { const p = generateSecurePassword(); setPassword(p); setShowPwd(true); }}
                      >
                        Generar contraseña segura
                      </button>
                    </div>
                  </>
                )}

                {submitError && (
                  <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
                    {submitError}
                  </div>
                )}

                {/* Already-member warning */}
                {alreadyMember && (
                  <div
                    style={{
                      padding: "10px 14px", background: "#fffbeb",
                      border: "1px solid #fde68a", borderRadius: 8,
                      fontSize: 13, marginBottom: 12,
                    }}
                  >
                    Este usuario ya es miembro del negocio con rol{" "}
                    <strong>{ROLE_LABEL[existingRole] ?? existingRole}</strong>.{" "}
                    Para cambiar el rol usa la opción &quot;Cambiar rol&quot; directamente desde la tabla.
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="button small"
                    onClick={handleSubmit}
                    disabled={submitting || alreadyMember || restaurants.length === 0}
                  >
                    {submitting ? "Guardando…" : "Crear"}
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function UsersClient({
  initialUsers,
  initialError,
  restaurants,
}: {
  initialUsers: UserRow[];
  initialError: string | null;
  restaurants: Restaurant[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [showModal, setShowModal] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<{ userId: string; email: string } | null>(null);

  // Filters
  const [filterQ, setFilterQ]           = useState("");
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [filterRole, setFilterRole]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Apply client-side filters
  const filtered = useMemo(() => {
    let list = users;
    const q = filterQ.toLowerCase().trim();
    if (q) list = list.filter((u) => u.email.toLowerCase().includes(q));
    if (filterRestaurant)
      list = list.filter((u) => u.memberships.some((m) => m.restaurantId === filterRestaurant));
    if (filterRole)
      list = list.filter((u) => u.memberships.some((m) => m.role === filterRole));
    if (filterStatus)
      list = list.filter((u) => u.memberships.some((m) => m.status === filterStatus));
    return list;
  }, [users, filterQ, filterRestaurant, filterRole, filterStatus]);

  function handleRoleChange(membershipId: string, newRole: string) {
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        memberships: u.memberships.map((m) =>
          m.membershipId === membershipId ? { ...m, role: newRole } : m,
        ),
      })),
    );
  }

  function handleRevoke(membershipId: string) {
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        memberships: u.memberships.map((m) =>
          m.membershipId === membershipId ? { ...m, status: "suspended" } : m,
        ),
      })),
    );
  }

  function handleUserCreated(newUser: UserRow) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.userId === newUser.userId);
      if (idx !== -1) {
        // Merge memberships into existing user
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          memberships: [...updated[idx].memberships, ...newUser.memberships],
        };
        return updated;
      }
      return [newUser, ...prev];
    });
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("es-VE", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="panel-page-header">
        <div>
          <h1 className="panel-page-title">Usuarios</h1>
          <p className="panel-page-desc">
            {users.length} usuario{users.length !== 1 ? "s" : ""} en la plataforma
          </p>
        </div>
        <div className="panel-page-actions">
          <button
            type="button"
            className="button small"
            onClick={() => setShowModal(true)}
          >
            + Crear usuario
          </button>
        </div>
      </div>

      <div className="panel-content">
        {initialError && (
          <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
            {initialError}
          </div>
        )}

        {/* Filter bar */}
        <div className="users-filter-bar">
          <div className="field">
            <input
              type="search"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              placeholder="Buscar por correo…"
              aria-label="Buscar usuario"
            />
          </div>
          <div className="field">
            <select
              value={filterRestaurant}
              onChange={(e) => setFilterRestaurant(e.target.value)}
              aria-label="Filtrar por negocio"
            >
              <option value="">Todos los negocios</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              aria-label="Filtrar por rol"
            >
              <option value="">Todos los roles</option>
              <option value="owner">Propietario</option>
              <option value="attention">Atención</option>
              <option value="kitchen">Cocina</option>
            </select>
          </div>
          <div className="field">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
              <option value="invited">Invitado</option>
            </select>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="panel-empty">
            <div className="panel-empty-icon" style={{ fontSize: 24 }}>👤</div>
            <p className="panel-empty-title">Sin usuarios</p>
            <p className="panel-empty-desc">
              {filterQ || filterRestaurant || filterRole || filterStatus
                ? "Ningún usuario coincide con los filtros."
                : "No hay usuarios registrados en la plataforma."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Registrado</th>
                      <th>Membresías</th>
                      <th style={{ width: "1%", whiteSpace: "nowrap" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.userId}>
                        <td>
                          <span className="user-email">{u.email}</span>
                        </td>
                        <td>
                          <span className="user-date">{formatDate(u.createdAt)}</span>
                        </td>
                        <td>
                          {u.memberships.length === 0 ? (
                            <span style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
                              Sin membresías
                            </span>
                          ) : (
                            <div className="membership-chips">
                              {u.memberships.map((m) => (
                                <MembershipChip
                                  key={m.membershipId}
                                  membership={m}
                                  onRoleChange={handleRoleChange}
                                  onRevoke={handleRevoke}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => setPwdTarget({ userId: u.userId, email: u.email })}
                          >
                            Cambiar contraseña
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="users-cards">
              {filtered.map((u) => (
                <div key={u.userId} className="user-card">
                  <div className="user-card-email">{u.email}</div>
                  <div className="user-card-date">{formatDate(u.createdAt)}</div>
                  {u.memberships.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
                      Sin membresías
                    </span>
                  ) : (
                    <div className="membership-chips">
                      {u.memberships.map((m) => (
                        <MembershipChip
                          key={m.membershipId}
                          membership={m}
                          onRoleChange={handleRoleChange}
                          onRevoke={handleRevoke}
                        />
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 12, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
                    <button
                      type="button"
                      className="button secondary small"
                      style={{ width: "100%", minHeight: 44 }}
                      onClick={() => setPwdTarget({ userId: u.userId, email: u.email })}
                    >
                      Cambiar contraseña
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create user modal */}
      {showModal && (
        <CreateUserModal
          restaurants={restaurants}
          onClose={() => setShowModal(false)}
          onCreated={(newUser) => {
            handleUserCreated(newUser);
            setShowModal(false);
          }}
        />
      )}

      {/* Change password modal */}
      {pwdTarget && (
        <ChangePasswordModal
          userId={pwdTarget.userId}
          email={pwdTarget.email}
          onClose={() => setPwdTarget(null)}
        />
      )}
    </>
  );
}
