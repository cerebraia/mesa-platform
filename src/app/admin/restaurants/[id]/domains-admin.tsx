"use client";

import { useState, useTransition } from "react";
import { manageDomain } from "../../actions";

type DomainRow = {
  id: string;
  host: string;
  kind: string;
  status: string;
  requested_by: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  requested:            "Solicitado",
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

export function DomainsAdmin({
  restaurantId,
  domains,
}: {
  restaurantId: string;
  domains: DomainRow[];
}) {
  if (domains.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        No hay dominios registrados para este restaurante.
      </p>
    );
  }

  return (
    <div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Host</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <DomainRow key={d.id} domain={d} restaurantId={restaurantId} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Guía de activación</p>
        <ol style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          <li>El dueño solicita el dominio desde su panel de configuración.</li>
          <li>El administrador marca el estado como «Pendiente de verificación DNS» e indica al dueño qué registro CNAME o A crear en su proveedor DNS.</li>
          <li>Verificar manualmente el registro DNS (ej. con <code>dig</code> o <code>nslookup</code>).</li>
          <li>Una vez verificado, activar el dominio desde este panel.</li>
          <li>En Railway: añadir el dominio personalizado en Settings → Domains del servicio. Railway emite el certificado TLS automáticamente.</li>
        </ol>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Activar el dominio aquí NO configura Railway ni DNS. Son pasos independientes.
        </p>
      </div>
    </div>
  );
}

function DomainRow({
  domain,
  restaurantId,
}: {
  domain: DomainRow;
  restaurantId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(newStatus: "active" | "pending_verification" | "disconnected") {
    setError(null);
    startTransition(async () => {
      const result = await manageDomain(domain.id, restaurantId, newStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <tr>
        <td>
          <strong style={{ fontSize: 13 }}>{domain.host}</strong>
        </td>
        <td style={{ fontSize: 12 }}>
          <span className="tag">{domain.kind === "custom" ? "Personalizado" : "Subdominio"}</span>
        </td>
        <td>
          <span
            className="tag"
            style={{
              color: STATUS_COLOR[domain.status] ?? "#777",
              background: `${STATUS_COLOR[domain.status] ?? "#777"}18`,
            }}
          >
            {STATUS_LABEL[domain.status] ?? domain.status}
          </span>
        </td>
        <td style={{ fontSize: 11, color: "var(--muted)" }}>
          {new Date(domain.updated_at).toLocaleDateString("es-VE")}
        </td>
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {domain.status !== "pending_verification" && domain.status !== "active" && (
              <button
                className="button secondary small"
                style={{ fontSize: 11 }}
                disabled={pending}
                onClick={() => handle("pending_verification")}
              >
                Marcar pendiente DNS
              </button>
            )}
            {domain.status !== "active" && (
              <button
                className="button small"
                style={{ fontSize: 11 }}
                disabled={pending}
                onClick={() => handle("active")}
              >
                Activar
              </button>
            )}
            {domain.status === "active" && (
              <button
                className="button secondary small"
                style={{ fontSize: 11, color: "#c62828", borderColor: "#c62828" }}
                disabled={pending}
                onClick={() => handle("disconnected")}
              >
                Desconectar
              </button>
            )}
          </div>
          {error && (
            <p style={{ color: "#a72b38", fontSize: 11, marginTop: 4 }}>{error}</p>
          )}
        </td>
      </tr>
    </>
  );
}
