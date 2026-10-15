"use client";

import { useState, useTransition } from "react";
import { requestDomain, cancelDomainRequest } from "./actions";

type DomainRow = {
  id: string;
  host: string;
  kind: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  requested:            "Solicitado — pendiente de revisión",
  pending_verification: "Pendiente de verificación DNS",
  active:               "Activo",
  disconnected:         "Desconectado",
};

const STATUS_COLOR: Record<string, string> = {
  requested:            "#e65100",
  pending_verification: "#1565c0",
  active:               "#2e7d32",
  disconnected:         "#777",
};

export function DomainSection({
  restaurantSlug,
  domains,
}: {
  restaurantSlug: string;
  domains: DomainRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [host, setHost] = useState("");

  function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await requestDomain(host);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setHost("");
      }
    });
  }

  function handleCancel(domainId: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelDomainRequest(domainId);
      if (result.error) setError(result.error);
    });
  }

  const activeDomains    = domains.filter((d) => d.status === "active");
  const pendingDomains   = domains.filter((d) => d.status !== "active" && d.status !== "disconnected");
  const otherDomains     = domains.filter((d) => d.status === "disconnected");
  const canRequest       = activeDomains.length + pendingDomains.length === 0;

  return (
    <div>
      <h2 style={{ fontSize: 17, marginBottom: 6 }}>Dominio personalizado</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
        Tu menú siempre está disponible en{" "}
        <code style={{ fontSize: 12 }}>/r/{restaurantSlug}</code>.
        Con un dominio propio, también estará en la raíz de ese dominio.
        El administrador de la plataforma revisará la solicitud y verificará
        el DNS antes de activarlo.
      </p>

      {/* Active domains */}
      {activeDomains.map((d) => (
        <div key={d.id} style={{
          padding: "10px 14px", background: "#f1f8f1", border: "1px solid #a5d6a7",
          borderRadius: 8, marginBottom: 10, display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 12,
        }}>
          <div>
            <strong style={{ fontSize: 13 }}>{d.host}</strong>
            <span className="tag" style={{ marginLeft: 8, color: "#2e7d32", background: "#e8f5e918" }}>
              {STATUS_LABEL[d.status]}
            </span>
          </div>
        </div>
      ))}

      {/* Pending domains */}
      {pendingDomains.map((d) => (
        <div key={d.id} style={{
          padding: "10px 14px", background: "#fff8e1", border: "1px solid #ffe082",
          borderRadius: 8, marginBottom: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <strong style={{ fontSize: 13 }}>{d.host}</strong>
              <span className="tag" style={{ marginLeft: 8, color: STATUS_COLOR[d.status], background: `${STATUS_COLOR[d.status]}18` }}>
                {STATUS_LABEL[d.status] ?? d.status}
              </span>
            </div>
            {(d.status === "requested") && (
              <button
                className="button secondary small"
                style={{ fontSize: 11 }}
                onClick={() => handleCancel(d.id)}
                disabled={pending}
              >
                Cancelar solicitud
              </button>
            )}
          </div>
          {d.status === "pending_verification" && (
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              Configura un registro CNAME apuntando a la dirección indicada por el administrador.
              La activación la realiza el administrador tras verificar el DNS.
            </p>
          )}
        </div>
      ))}

      {/* Disconnected domains */}
      {otherDomains.map((d) => (
        <div key={d.id} style={{
          padding: "10px 14px", border: "1px solid var(--border)",
          borderRadius: 8, marginBottom: 10, opacity: 0.7,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <div>
            <span style={{ fontSize: 13 }}>{d.host}</span>
            <span className="tag" style={{ marginLeft: 8 }}>Desconectado</span>
          </div>
          <button
            className="button secondary small"
            style={{ fontSize: 11 }}
            onClick={() => handleCancel(d.id)}
            disabled={pending}
          >
            Eliminar
          </button>
        </div>
      ))}

      {/* Request form */}
      {canRequest && (
        <form onSubmit={handleRequest} style={{ maxWidth: 480, marginTop: domains.length > 0 ? 16 : 0 }}>
          <label className="field-label">
            Dominio a solicitar
            <input
              type="text"
              required
              value={host}
              onChange={(e) => setHost(e.target.value.toLowerCase().trim())}
              placeholder="ej. mirestaurante.com"
              autoComplete="off"
            />
          </label>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Solo dominios propios (no subdominios de plataforma). El
            administrador revisará la solicitud antes de activar.
          </p>
          {error && (
            <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          {saved && (
            <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 10 }}>
              Solicitud enviada. El administrador la revisará pronto.
            </p>
          )}
          <button type="submit" className="button small" disabled={pending} style={{ marginTop: 16 }}>
            {pending ? "Enviando…" : "Solicitar dominio"}
          </button>
        </form>
      )}

      {!canRequest && domains.every((d) => d.status === "active") && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          Para cambiar el dominio, contacta al administrador.
        </p>
      )}
    </div>
  );
}
