"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  LayoutGrid,
  Settings,
  ExternalLink,
  Menu,
  X,
  LogOut,
} from "lucide-react";
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
    { href: "/panel",         label: "Inicio",                          icon: <LayoutDashboard size={16} />, exact: true, group: "main" },
    { href: "/panel/pedidos", label: role === "kitchen" ? "Cocina" : "Pedidos", icon: <ClipboardList   size={16} />,              group: "main" },
  ];
  if (role === "owner") {
    items.push(
      { href: "/panel/menu",          label: "Catálogo",      icon: <LayoutGrid size={16} />, group: "mgmt" },
      { href: "/panel/configuracion", label: "Configuración", icon: <Settings   size={16} />, group: "mgmt" },
    );
  }
  items.push({ href: `/r/${slug}`, label: "Ver menú", icon: <ExternalLink size={14} />, external: true, group: "ext" });
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

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
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

function ShellInner({ role, restaurantName, restaurantSlug, userEmail, children }: ShellProps) {
  const pathname      = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef     = useRef<HTMLElement>(null);
  const items         = buildNavItems(role, restaurantSlug);
  const initials      = restaurantName.slice(0, 2).toUpperCase();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        drawerRef.current && !drawerRef.current.contains(e.target as Node) &&
        menuButtonRef.current && !menuButtonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
        <LogOut size={14} />
        Cerrar sesión
      </UnsavedAwareButton>
    </div>
  );

  return (
    <div className="dashboard">
      {/* ── Desktop sidebar ─── */}
      <aside className="sidebar">
        <Brand />
        <WorkspaceBlock />
        <nav aria-label="Panel" className="sidebar-nav">
          <NavLinks items={items} pathname={pathname} />
        </nav>
        <BottomBlock />
      </aside>

      {/* ── Main ─── */}
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
            {open ? <X size={20} /> : <Menu size={20} />}
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
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <span className="sidebar-bottom-email" style={{ display: "block", marginBottom: 10 }}>
                {userEmail}
              </span>
              <UnsavedAwareButton
                className="sidebar-signout"
                onClick={async () => { await signOut(); }}
              >
                <LogOut size={14} />
                Cerrar sesión
              </UnsavedAwareButton>
            </div>
          </nav>
        )}

        {/* Shell topbar: Ver menú (desktop) */}
        <div className="panel-topbar">
          <a
            href={`/r/${restaurantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ver-menu"
          >
            <ExternalLink size={13} />
            Ver menú
          </a>
        </div>

        {children}
      </main>
    </div>
  );
}

export function PanelShell(props: ShellProps) {
  return (
    <UnsavedChangesProvider>
      <ShellInner {...props} />
    </UnsavedChangesProvider>
  );
}
