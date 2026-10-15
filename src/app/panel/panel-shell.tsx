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

// ── Icons ─────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconOrders() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="15" y2="16"/>
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Nav items ─────────────────────────────────────────────────────

type NavItem = {
  href:      string;
  label:     string;
  icon:      React.ReactNode;
  exact?:    boolean;
  external?: boolean;
  group:     "main" | "mgmt" | "ext";
};

function buildNavItems(role: MemberRole, slug: string): NavItem[] {
  const items: NavItem[] = [
    {
      href:  "/panel",
      label: "Inicio",
      icon:  <IconHome />,
      exact: true,
      group: "main",
    },
    {
      href:  "/panel/pedidos",
      label: role === "kitchen" ? "Cola de cocina" : "Pedidos",
      icon:  <IconOrders />,
      group: "main",
    },
  ];

  if (role === "owner") {
    items.push(
      { href: "/panel/menu",          label: "Catálogo",      icon: <IconGrid />,     group: "mgmt" },
      { href: "/panel/configuracion", label: "Configuración", icon: <IconSettings />, group: "mgmt" },
    );
  }

  items.push({
    href:     `/r/${slug}`,
    label:    "Ver menú",
    icon:     <IconExternal />,
    external: true,
    group:    "ext",
  });

  return items;
}

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (href.startsWith("/r/")) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// ── Shell props ───────────────────────────────────────────────────

interface ShellProps {
  role:           MemberRole;
  restaurantName: string;
  restaurantSlug: string;
  userEmail:      string;
  children:       React.ReactNode;
}

// ── NavLinks helper ───────────────────────────────────────────────

function NavLinks({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  const groups: { key: NavItem["group"]; label: string | null }[] = [
    { key: "main", label: null },
    { key: "mgmt", label: "GESTIÓN" },
    { key: "ext",  label: null },
  ];

  return (
    <>
      {groups.map(({ key, label }) => {
        const groupItems = items.filter((i) => i.group === key);
        if (!groupItems.length) return null;
        return (
          <div key={key} className={key !== "main" ? "sidebar-group" : undefined}>
            {label && <div className="sidebar-group-label">{label}</div>}
            {groupItems.map((item) => {
              const active = isActive(item.href, pathname, item.exact);
              return (
                <UnsavedAwareLink
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </UnsavedAwareLink>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ── ShellInner ────────────────────────────────────────────────────

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

  const items    = buildNavItems(role, restaurantSlug);
  const initials = restaurantName.slice(0, 2).toUpperCase();

  // Close drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  // Escape closes the drawer
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

  // Click outside closes the drawer
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

  const WorkspaceBlock = () => (
    <div className="sidebar-workspace">
      <div className="sidebar-avatar">{initials}</div>
      <div style={{ minWidth: 0 }}>
        <span className="sidebar-name">{restaurantName}</span>
        <span className="sidebar-role">{ROLE_LABEL[role]}</span>
      </div>
    </div>
  );

  const BottomBlock = () => (
    <div className="sidebar-bottom-v2">
      <span className="sidebar-bottom-email">{userEmail}</span>
      <UnsavedAwareButton
        className="sidebar-signout"
        onClick={async () => { await signOut(); }}
      >
        Cerrar sesión
      </UnsavedAwareButton>
    </div>
  );

  return (
    <div className="dashboard">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="sidebar">
        <Brand />
        <WorkspaceBlock />
        <nav aria-label="Panel" className="sidebar-nav">
          <NavLinks items={items} pathname={pathname} />
        </nav>
        <BottomBlock />
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <main className="dashboard-main" style={{ minWidth: 0 }}>
        {/* Mobile header */}
        <div className="panel-mobile-header">
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="panel-mobile-drawer"
            onClick={() => setOpen((v) => !v)}
            className="panel-mobile-menu-btn"
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <nav
            id="panel-mobile-drawer"
            ref={drawerRef}
            aria-label="Navegación del panel"
            className="panel-mobile-drawer"
          >
            <WorkspaceBlock />
            <NavLinks items={items} pathname={pathname} />
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <span className="sidebar-bottom-email" style={{ display: "block", marginBottom: 10 }}>
                {userEmail}
              </span>
              <UnsavedAwareButton
                className="sidebar-signout"
                onClick={async () => { await signOut(); }}
              >
                Cerrar sesión
              </UnsavedAwareButton>
            </div>
          </nav>
        )}

        {children}
      </main>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────

export function PanelShell(props: ShellProps) {
  return (
    <UnsavedChangesProvider>
      <ShellInner {...props} />
    </UnsavedChangesProvider>
  );
}
