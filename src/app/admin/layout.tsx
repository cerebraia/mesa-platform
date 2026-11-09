import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { AdminShell } from "./admin-shell";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Preserve the requested admin path so the user lands there after login.
    // The request path is available via the x-invoke-path header or via
    // the headers() API in Next.js App Router.
    // The proxy already adds ?next= to the /login redirect, but layout runs
    // after the proxy so we can rely on the proxy having done it.  However
    // if the proxy somehow misses it (direct SSR render without proxy) we
    // fall back to /admin here.
    redirect("/login");
  }

  // Authorization: check platform_admins — never trust token claims.
  // Filter by user_id to avoid ambiguous results when multiple admins exist.
  const { data: adminRow, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // A query error is a real failure — do not silently treat it as "no access".
  if (adminError) {
    throw new Error(
      `Error al verificar permisos de administrador: ${adminError.message}`,
    );
  }

  // Not a platform admin: show an explicit denial screen instead of silently
  // redirecting to /panel.  This tells the user what happened and lets them
  // go to their own panel intentionally.
  if (!adminRow) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          className="container"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            minHeight: 64, borderBottom: "1px solid var(--border)",
          }}
        >
          <Brand />
          <SignOutButton />
        </header>
        <div className="access-pending" style={{ maxWidth: 440 }}>
          <div
            className="avatar"
            style={{ width: 52, height: 52, fontSize: 15, marginBottom: 24, background: "#fef2f2", color: "#a72b38" }}
          >
            ✕
          </div>
          <h2 style={{ marginBottom: 10 }}>Acceso restringido</h2>
          <p className="muted" style={{ fontSize: 14, maxWidth: 360, marginBottom: 28 }}>
            Tu cuenta no tiene acceso al administrador de Wacatalog.
            Si crees que es un error, contacta a quien gestiona la plataforma.
          </p>
          <Link href="/panel" className="button">
            Ir a mi panel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell userEmail={user.email ?? ""}>
      {children}
    </AdminShell>
  );
}
