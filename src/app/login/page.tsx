"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Brand } from "@/components/brand";
import { signIn, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button full">
      {pending ? "Verificando…" : "Ingresar"}
    </button>
  );
}

const initial: LoginState = { error: null };

export default function LoginPage() {
  const [state, action] = useActionState(signIn, initial);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <h1>Accede a tu espacio</h1>
        <p className="muted" style={{ marginBottom: 28, fontSize: 14 }}>
          Usa las credenciales que recibiste de Mesa.
        </p>

        <form action={action}>
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
            </p>
          )}

          <SubmitButton />
        </form>

        <p
          className="muted"
          style={{ fontSize: 12, marginTop: 24, textAlign: "center" }}
        >
          <Link href="/" className="text-link" style={{ fontSize: 12 }}>
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
