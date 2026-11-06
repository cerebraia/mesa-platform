"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, RefreshCw, Link as LinkIcon } from "lucide-react";
import {
  assignOwner,
  setOwnerPassword,
  generatePasswordResetLink,
} from "../../actions";

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
  // Shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

interface AssignResult {
  method?: string;
  email?: string;
  userId?: string;
  invitePending?: boolean;
  note?: string;
}

export function AssignOwnerForm({ restaurantId }: { restaurantId: string }) {
  const [pending, startTransition]   = useTransition();
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<AssignResult | null>(null);
  const [showPwd, setShowPwd]         = useState(false);
  const [password, setPassword]       = useState("");

  // Post-assign: change password section
  const [pwdPending, startPwdTransition] = useTransition();
  const [pwdError, setPwdError]       = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess]   = useState<string | null>(null);
  const [newPwd, setNewPwd]           = useState("");
  const [showNewPwd, setShowNewPwd]   = useState(false);

  // Reset link section
  const [linkPending, startLinkTransition] = useTransition();
  const [linkError, setLinkError]     = useState<string | null>(null);
  const [resetLink, setResetLink]     = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await assignOwner(restaurantId, email, password || undefined);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({
          method:        (res.data as Record<string, string> | undefined)?.method,
          email:         (res.data as Record<string, string> | undefined)?.email ?? email,
          userId:        (res.data as Record<string, string> | undefined)?.userId,
          invitePending: res.invitePending,
          note:          res.inviteNote,
        });
        (e.target as HTMLFormElement).reset();
        setPassword("");
      }
    });
  }

  function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!result?.userId) {
      setPwdError("No se encontró userId del dueño asignado.");
      return;
    }
    setPwdError(null);
    setPwdSuccess(null);
    startPwdTransition(async () => {
      const res = await setOwnerPassword(result.userId!, newPwd);
      if (res.error) {
        setPwdError(res.error);
      } else {
        setPwdSuccess("Contraseña actualizada correctamente.");
        setNewPwd("");
      }
    });
  }

  function handleGenerateLink() {
    if (!result?.email) return;
    setLinkError(null);
    setResetLink(null);
    startLinkTransition(async () => {
      const res = await generatePasswordResetLink(result.email!);
      if (res.error) {
        setLinkError(res.error);
      } else {
        setResetLink(res.link ?? null);
      }
    });
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {/* ── Assign owner form ── */}
      <form onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Correo del dueño</label>
          <input
            name="email"
            type="email"
            required
            placeholder="owner@ejemplo.com"
            autoComplete="off"
          />
        </div>

        <div className="field" style={{ marginBottom: 4 }}>
          <label>Contraseña (opcional)</label>
          <div className="pwd-field-wrap">
            <input
              type={showPwd ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="button secondary small"
            onClick={() => { const p = generateSecurePassword(); setPassword(p); setShowPwd(true); }}
          >
            <RefreshCw size={13} style={{ marginRight: 4 }} />
            Generar contraseña segura
          </button>
        </div>

        <span className="caption" style={{ display: "block", marginBottom: 12 }}>
          Si dejas la contraseña vacía, se envía invitación por correo.
          Esta operación nunca concede platform_admin.
        </span>

        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" className="button small" disabled={pending}>
          {pending ? "Asignando…" : "Asignar dueño"}
        </button>
      </form>

      {/* ── Result feedback ── */}
      {result && !result.invitePending && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 14 }}>
          {result.method === "existing_user"
            ? `Dueño asignado: ${result.email} (cuenta existente).`
            : `Invitación enviada a ${result.email}.`}
        </p>
      )}

      {result?.invitePending && (
        <div
          role="alert"
          style={{
            marginTop: 12, padding: "10px 14px",
            background: "#fff8e1", border: "1px solid #ffe082",
            borderRadius: 8, fontSize: 12,
          }}
        >
          <strong>Invitación pendiente:</strong> {result.note}
        </div>
      )}

      {/* ── Change password (shown after successful assign with userId) ── */}
      {result && result.userId && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #E8E9EF" }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#202337" }}>
            Cambiar contraseña del dueño
          </p>
          <form onSubmit={handleChangePassword}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Nueva contraseña</label>
              <div className="pwd-field-wrap">
                <input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-field-toggle"
                  aria-label={showNewPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowNewPwd((v) => !v)}
                >
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <button
                type="button"
                className="button secondary small"
                onClick={() => { const p = generateSecurePassword(); setNewPwd(p); setShowNewPwd(true); }}
              >
                <RefreshCw size={13} style={{ marginRight: 4 }} />
                Generar
              </button>
              <button type="submit" className="button small" disabled={pwdPending}>
                {pwdPending ? "Guardando…" : "Actualizar contraseña"}
              </button>
            </div>
            {pwdError   && <div className="auth-error" role="alert">{pwdError}</div>}
            {pwdSuccess && <p style={{ color: "#2e7d32", fontSize: 13 }}>{pwdSuccess}</p>}
          </form>

          {/* ── Reset link ── */}
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="button secondary small"
              disabled={linkPending}
              onClick={handleGenerateLink}
            >
              <LinkIcon size={13} style={{ marginRight: 4 }} />
              {linkPending ? "Generando…" : "Generar enlace de recuperación"}
            </button>
            {linkError && (
              <div className="auth-error" role="alert" style={{ marginTop: 8 }}>
                {linkError}
              </div>
            )}
            {resetLink && (
              <div
                style={{
                  marginTop: 10, padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, fontSize: 12,
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 6, color: "#166534" }}>
                  Enlace de recuperación (uso único):
                </p>
                <input
                  readOnly
                  value={resetLink}
                  style={{ width: "100%", fontSize: 11, padding: "6px 8px", borderRadius: 6 }}
                  onFocus={(e) => e.target.select()}
                />
                <p className="caption" style={{ marginTop: 6 }}>
                  Este enlace expira. Cópialo y envíalo al propietario de forma segura.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
