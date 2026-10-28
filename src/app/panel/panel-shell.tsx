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
  RefreshCw,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/brand";
import {
  UnsavedChangesProvider,
  UnsavedAwareLink,
  UnsavedAwareButton,
} from "@/components/unsaved-changes";
import { signOut } from "@/app/login/actions";
import type { MemberRole } from "@/lib/db-types";
import type { MembershipOption } from "@/lib/panel-context";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner:     "Propietario",
  attention: "Atención",
  kitchen:   "Cocina",
};

type NavItem = {
  href:   string;
  label:  string;
  icon:   React.ReactNode;
  exact?: boolean;
  group:  "main" | "mgmt";
};

function buildNavItems(role: MemberRole): NavItem[] {
  const items: NavItem[] = [
    { href: "/panel",         label: "Inicio",        icon: <LayoutDashboard size={20} />, exact: true, group: "main" },
    { href: "/panel/pedidos", label: role === "kitchen" ? "Cocina" : "Pedidos", icon: <ClipboardList size={20} />, group: "main" },
  ];
  if (role === "owner") {
    items.push(
      { href: "/panel/menu",          label: "Catálogo",      icon: <LayoutGrid size={20} />, group: "mgmt" },
      { href: "/panel/finanzas",      label: "Finanzas",      icon: <Wallet     size={20} />, group: "mgmt" },
      { href: "/panel/configuracion", label: "Configuración", icon: <Settings   size={20} />, group: "mgmt" },
    );
  }
  return items;
}

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// Derive the current section label from the pathname and nav items
function getCurrentSection(pathname: string, items: NavItem[]): string {
  // Sort by length descending to match most specific route first
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length);
  for (const item of sorted) {
    if (isActive(item.href, pathname, item.exact)) return item.label;
  }
  // Admin or other routes
  if (pathname.startsWith("/admin")) return "Administración";
  return "Panel";
}

// ── Business block ─────────────────────────────────────────────────

function BusinessDisplay({
  restaurantName,
  role,
  hasMultiple,
}: {
  restaurantName: string;
  role: MemberRole;
  hasMultiple: boolean;
}) {
  const initials = restaurantName.slice(0, 2).toUpperCase();
  return (
    <div className="sb-biz-block">
      <div className="sb-biz-row">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sb-biz-info">
          <span className="sidebar-name">{restaurantName}</span>
          <span className="sidebar-role">{ROLE_LABEL[role]}</span>
        </div>
      </div>
      {hasMultiple && (
        <UnsavedAwareLink href="/seleccionar-negocio" className="sb-biz-change">
          <RefreshCw size={11} aria-hidden="true" />
          Cambiar negocio
        </UnsavedAwareLink>
      )}
    </div>
  );
}

// ── Nav links ──────────────────────────────────────────────────────

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const groups: { key: NavItem["group"]; label: string | null }[] = [
    { key: "main", label: null },
    { key: "mgmt", label: "Gestión" },
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
                  className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                  <span className="sidebar-link-label">{item.label}</span>
                </UnsavedAwareLink>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ── Shell ──────────────────────────────────────────────────────────

interface ShellProps {
  role:              MemberRole;
  restaurantName:    string;
  restaurantSlug:    string;
  restaurantId:      string;
  userEmail:         string;
  ordersEnabled:     boolean;
  membershipOptions: MembershipOption[];
  children:          React.ReactNode;
}

function ShellInner({
  role, restaurantName, restaurantSlug, restaurantId: _restaurantId,
  userEmail, ordersEnabled, membershipOptions, children,
}: ShellProps) {
  const pathname      = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef     = useRef<HTMLElement>(null);
  const items         = buildNavItems(role);
  const hasMultiple   = membershipOptions.length > 1;
  const sectionLabel  = getCurrentSection(pathname, items);
  const catalogLabel  = ordersEnabled ? "Ver menú" : "Ver catálogo";
  const catalogHref   = `/r/${restaurantSlug}`;

  // Close drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  // Escape key closes drawer
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  // Click outside closes drawer
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

  // Scroll lock when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const emailInitials = userEmail.slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="sb-brand-wrap">
        <Brand />
      </div>

      {/* Business block */}
      <BusinessDisplay
        restaurantName={restaurantName}
        role={role}
        hasMultiple={hasMultiple}
      />

      {/* Nav */}
      <nav aria-label="Panel" className="sidebar-nav">
        <NavLinks items={items} pathname={pathname} />
      </nav>

      {/* Bottom: profile + logout */}
      <div className="sidebar-bottom-v2">
        <div className="sb-user-row">
          <div className="sb-user-avatar">{emailInitials}</div>
          <span className="sidebar-bottom-email">{userEmail}</span>
        </div>
        <UnsavedAwareButton
          className="sidebar-signout"
          onClick={async () => { await signOut(); }}
        >
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </UnsavedAwareButton>
      </div>
    </>
  );

  return (
    <div className="dashboard">
      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="sidebar" aria-label="Navegación del panel">
        <SidebarContent />
      </aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="dashboard-main">
        {/* Mobile sticky top bar */}
        <div className="panel-mobile-header">
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="panel-mobile-drawer"
            className="panel-mobile-menu-btn"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile drawer backdrop */}
        {open && (
          <div
            className="panel-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Mobile drawer (slides in from left) */}
        <nav
          id="panel-mobile-drawer"
          ref={drawerRef}
          aria-label="Navegación del panel"
          className={`panel-mobile-drawer${open ? " panel-mobile-drawer--open" : ""}`}
          aria-hidden={!open}
        >
          <div className="panel-drawer-close-row">
            <Brand />
            <button
              aria-label="Cerrar menú"
              className="panel-mobile-menu-btn"
              onClick={() => setOpen(false)}
            >
              <X size={22} />
            </button>
          </div>

          <BusinessDisplay
            restaurantName={restaurantName}
            role={role}
            hasMultiple={hasMultiple}
          />

          <nav aria-label="Panel" className="sidebar-nav">
            <NavLinks items={items} pathname={pathname} />
          </nav>

          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="sb-user-row" style={{ marginBottom: 8 }}>
              <div className="sb-user-avatar">{emailInitials}</div>
              <span className="sidebar-bottom-email">{userEmail}</span>
            </div>
            <UnsavedAwareButton
              className="sidebar-signout"
              onClick={async () => { await signOut(); }}
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </UnsavedAwareButton>
          </div>
        </nav>

        {/* Shell header: section title + "Ver catálogo/menú" */}
        <div className="shell-header">
          <span className="shell-header-section">{sectionLabel}</span>
          <a
            href={catalogHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shell-catalog-btn"
            aria-label={catalogLabel}
          >
            <ArrowUpRight size={14} aria-hidden="true" />
            {catalogLabel}
          </a>
        </div>

        {/* Page content */}
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
