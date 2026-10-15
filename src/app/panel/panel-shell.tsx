"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import {
  UnsavedChangesProvider,
  UnsavedAwareLink,
  UnsavedAwareButton,
} from "@/components/unsaved-changes";
import { signOut } from "@/app/login/actions";
import type { MemberRole } from "@/lib/db-types";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

interface NavItem {
  href:     string;
  label:    string;
  exact?:   boolean;
  external?: boolean;
}

function navItems(role: MemberRole, slug: string): NavItem[] {
  const items: NavItem[] = [
    { href: "/panel",         label: "Inicio",         exact: true },
    { href: "/panel/pedidos", label: "Pedidos" },
  ];
  if (role === "owner") {
    items.push(
      { href: "/panel/menu",          label: "Catálogo" },
      { href: "/panel/configuracion", label: "Configuración" },
    );
  }
  items.push({ href: `/r/${slug}`, label: "Ver menú ↗", external: true });
  return items;
}

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (href.startsWith("/r/")) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

interface ShellProps {
  role:           MemberRole;
  restaurantName: string;
  restaurantSlug: string;
  userEmail:      string;
  children:       React.ReactNode;
}

// Inner shell — lives inside UnsavedChangesProvider, so it can call the hook.
function ShellInner({
  role,
  restaurantName,
  restaurantSlug,
  userEmail,
  children,
}: ShellProps) {
  const pathname      = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef     = useRef<HTMLElement>(null);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Escape closes the hamburger drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Trap clicks outside drawer on mobile
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items    = navItems(role, restaurantSlug);
  const initials = restaurantName.slice(0, 2).toUpperCase();

  const navLinkStyle = (active: boolean): React.CSSProperties => ({
    display:        "flex",
    gap:            14,
    textAlign:      "left",
    border:         0,
    padding:        "12px 14px",
    borderRadius:   9,
    fontSize:       13,
    textDecoration: "none",
    fontWeight:     active ? 600 : 400,
    background:     active ? "var(--soft)" : "none",
    color:          active ? "var(--purple)" : "var(--muted)",
  });

  const NavLinks = () => (
    <>
      {items.map((item) => {
        const active = isActive(item.href, pathname, item.exact);
        return (
          <UnsavedAwareLink
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            style={navLinkStyle(active)}
          >
            {item.label}
          </UnsavedAwareLink>
        );
      })}
    </>
  );

  const SignOut = () => (
    <UnsavedAwareButton
      className="button secondary small"
      onClick={async () => { await signOut(); }}
    >
      Cerrar sesión
    </UnsavedAwareButton>
  );

  return (
    <div className="dashboard">
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <aside className="sidebar" style={{ position: "relative", zIndex: 10 }}>
        <Brand />

        <div className="workspace">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {restaurantName}
            </b>
            <span className="muted" style={{ fontSize: 11 }}>{ROLE_LABEL[role]}</span>
          </div>
        </div>

        <nav aria-label="Panel" style={{ flex: 1 }}>
          <NavLinks />
        </nav>

        <div className="sidebar-bottom">
          <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </span>
          <SignOut />
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="dashboard-main" style={{ minWidth: 0 }}>
        {/* Mobile header */}
        <div
          className="panel-mobile-header"
          style={{
            display:        "none",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "0 20px",
            minHeight:      56,
            borderBottom:   "1px solid var(--border)",
            background:     "white",
            position:       "sticky",
            top:            0,
            zIndex:         20,
          }}
        >
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="panel-mobile-drawer"
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px", color: "var(--ink)", fontSize: 22, lineHeight: 1,
            }}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <nav
            id="panel-mobile-drawer"
            ref={drawerRef}
            aria-label="Navegación del panel"
            style={{
              position:  "fixed", top: 56, left: 0, right: 0, bottom: 0,
              background: "white", zIndex: 30, overflowY: "auto",
              padding: "16px 20px 32px", borderTop: "1px solid var(--border)",
            }}
          >
            <div className="workspace" style={{ marginBottom: 12 }}>
              <div className="avatar">{initials}</div>
              <div>
                <b style={{ fontSize: 12, display: "block" }}>{restaurantName}</b>
                <span className="muted" style={{ fontSize: 11 }}>{ROLE_LABEL[role]}</span>
              </div>
            </div>
            <NavLinks />
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{userEmail}</span>
              <SignOut />
            </div>
          </nav>
        )}

        {children}
      </main>

      <style>{`
        @media (max-width: 760px) {
          .panel-mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

// Public export — wraps ShellInner in the provider.
export function PanelShell(props: ShellProps) {
  return (
    <UnsavedChangesProvider>
      <ShellInner {...props} />
    </UnsavedChangesProvider>
  );
}
