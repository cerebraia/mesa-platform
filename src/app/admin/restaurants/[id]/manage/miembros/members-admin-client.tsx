"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { adminAddMember, adminRemoveMember } from "../actions";

type MemberRow = { id: string; user_id: string; role: string; status: string; created_at: string };

interface Props {
  restaurantId: string;
  members:      MemberRow[];
}

const ROLE_LABEL: Record<string, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

export function MembersAdminClient({ restaurantId, members }: Props) {
  const [showForm, setShowForm]     = useState(false);
  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState("attention");
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const router = useRouter();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    startTransition(async () => {
      const res = await adminAddMember(restaurantId, email, role);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Miembro ${email} añadido con rol ${ROLE_LABEL[role]}.`);
        setEmail(""); setShowForm(false);
        router.refresh();
      }
    });
  }

  function handleRemove(memberId: string, memberRole: string) {
    if (!confirm(`¿Quitar al miembro con rol "${ROLE_LABEL[memberRole] ?? memberRole}"?`)) return;
    setError(null); setSuccess(null);
    startTransition(async () => {
      const res = await adminRemoveMember(restaurantId, memberId);
      if (res.error) setError(res.error);
      else { setSuccess("Miembro eliminado."); router.refresh(); }
    });
  }

  return (
    <>
      {/* Add member form */}
      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Añadir miembro</h2>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="button small" style={{ fontSize: 12 }}>
              <Plus size={13} />
              Añadir
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: "#667085", marginBottom: 8 }}>
          Solo usuarios con cuenta existente. Para propietarios usa la sección «Propietario» en{" "}
          <a href={`/admin/restaurants/${restaurantId}`} style={{ color: "var(--purple)" }}>
            datos del negocio
          </a>.
        </p>

        {showForm && (
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <input
              type="email" required placeholder="correo@ejemplo.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ minWidth: 140 }}>
              <option value="attention">Atención</option>
              <option value="kitchen">Cocina</option>
            </select>
            <button type="submit" className="button small" disabled={pending}>
              {pending ? "Añadiendo…" : "Añadir"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="button secondary small">
              Cancelar
            </button>
          </form>
        )}
      </div>

      {error   && <div className="auth-error"    role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ padding: "10px 14px", background: "#F0FDF4", border: "1px solid #86EFAC",
        borderRadius: 8, fontSize: 13, color: "#166534", marginBottom: 12 }}>{success}</div>}

      {/* Members list */}
      {members.length === 0 ? (
        <div className="panel-empty">
          <p className="panel-empty-title">Sin miembros</p>
          <p className="panel-empty-desc">Este negocio no tiene miembros asignados.</p>
        </div>
      ) : (
        <div className="dashboard-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Desde</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <code style={{ fontSize: 11, color: "#667085", wordBreak: "break-all" }}>
                        {m.user_id}
                      </code>
                    </td>
                    <td>
                      <span className="order-status-badge badge-accepted">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td>
                      <span className={`order-status-badge ${m.status === "active" ? "badge-ready" : "badge-cancelled"}`}>
                        {m.status === "active" ? "Activo" : m.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#667085" }}>
                      {new Date(m.created_at).toLocaleDateString("es-VE")}
                    </td>
                    <td>
                      <button
                        disabled={pending}
                        onClick={() => handleRemove(m.id, m.role)}
                        className="button secondary small"
                        style={{ fontSize: 11, color: "#DC2626" }}
                      >
                        <Trash2 size={12} />
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
