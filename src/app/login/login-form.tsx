"use client";

import { useState, useCallback } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { signIn, type LoginState } from "./actions";
import type { BizBrand } from "@/lib/biz-brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button full">
      {pending ? "Verificando…" : "Ingresar"}
    </button>
  );
}

const initial: LoginState = { error: null };

// ── Logo with initials fallback ───────────────────────────────────────────────

function BizLogo({
  logoUrl,
  name,
  size = "lg",
}: {
  logoUrl: string | null;
  name:    string;
  size?:   "lg" | "sm";
}) {
  const [err, setErr] = useState(false);
  const handleErr     = useCallback(() => setErr(true), []);
  const initials      = name.slice(0, 2).toUpperCase();
  const cls           = size === "sm" ? "bl-mobile-logo" : "bl-logo-wrap";

  if (logoUrl && !err) {
    return (
      <div className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" onError={handleErr} />
      </div>
    );
  }
  return (
    <div className={cls}>
      <span className="bl-logo-initials">{initials}</span>
    </div>
  );
}

// ── Branded left panel ────────────────────────────────────────────────────────

function BrandPanel({ brand }: { brand: BizBrand }) {
  return (
    <aside
      className="bl-panel"
      style={
        { "--biz-primary": brand.primaryColor, "--biz-text": brand.textColor } as React.CSSProperties
      }
    >
      <div className="bl-panel-main">
        <BizLogo logoUrl={brand.logoUrl} name={brand.name} size="lg" />
        <h2 className="bl-biz-name">{brand.name}</h2>
        <a href={brand.catalogUrl} className="bl-catalog-link">
          ← Ver catálogo
        </a>
      </div>
      <p className="bl-panel-foot">
        Acceso gestionado por <strong>Wacatalog</strong>
      </p>
    </aside>
  );
}

// ── Mobile strip (compact brand header) ──────────────────────────────────────

function MobileStrip({ brand }: { brand: BizBrand }) {
  return (
    <div
      className="bl-mobile-strip"
      style={
        { "--biz-primary": brand.primaryColor, "--biz-text": brand.textColor } as React.CSSProperties
      }
    >
      <BizLogo logoUrl={brand.logoUrl} name={brand.name} size="sm" />
      <span className="bl-mobile-name">{brand.name}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LoginForm({
  brand,
  negocio,
  next,
}: {
  brand:   BizBrand | null;
  negocio: string;
  next:    string | null;
}) {
  const [state, action] = useActionState(signIn, initial);

  // After a successful auth but with no access, offer an escape hatch.
  if (state.noAccess) {
    if (brand) {
      return (
        <div className="bl-page">
          <BrandPanel brand={brand} />
          <MobileStrip brand={brand} />
          <div className="bl-form-col">
            <div className="bl-form-card">
              <Brand />
              <h1 className="bl-form-card-h1">Sin acceso a {brand.name}</h1>
              <div className="bl-no-access">
                <p>Tu cuenta no tiene acceso a este negocio.</p>
                <Link href="/login">Ir al acceso general →</Link>
              </div>
              <div className="bl-form-foot">
                <a href={brand.catalogUrl}>← Ver catálogo</a>
                <span className="bl-powered">Acceso por Wacatalog</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Brand />
          <h1>Sin acceso</h1>
          <p className="muted" style={{ fontSize: 14, margin: "12px 0 20px" }}>
            Tu cuenta no tiene acceso a este negocio.
          </p>
          <Link href="/login" className="button full">
            Ir al acceso general
          </Link>
        </div>
      </div>
    );
  }

  const form = (
    <form action={action}>
      {negocio && (
        <input type="hidden" name="negocio" value={negocio} />
      )}
      {next && (
        <input type="hidden" name="next" value={next} />
      )}
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      {state.error && (
        <p className="auth-error" role="alert">
          {state.error}
          {state.noAccess === false && negocio && (
            <> · <Link href="/login" style={{ color: "inherit", fontWeight: 600 }}>Acceso general</Link></>
          )}
        </p>
      )}
      <SubmitButton />
    </form>
  );

  // ── Branded layout ─────────────────────────────────────────────────────────
  if (brand) {
    return (
      <div className="bl-page">
        <BrandPanel brand={brand} />
        <MobileStrip brand={brand} />
        <div className="bl-form-col">
          <div className="bl-form-card">
            <Brand />
            <h1 className="bl-form-card-h1">Accede al panel de {brand.name}</h1>
            <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
              Usa las credenciales que recibiste de Wacatalog.
            </p>
            {form}
            <div className="bl-form-foot">
              <a href={brand.catalogUrl}>← Ver catálogo</a>
              <span className="bl-powered">Acceso gestionado por Wacatalog</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard layout ────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <h1>Accede a tu espacio</h1>
        <p className="muted" style={{ marginBottom: 28, fontSize: 14 }}>
          Usa las credenciales que recibiste de Wacatalog.
        </p>
        {form}
        <p className="muted" style={{ fontSize: 12, marginTop: 24, textAlign: "center" }}>
          <Link href="/" className="text-link" style={{ fontSize: 12 }}>
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
