"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Store,
  Package,
  Menu,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { signOut } from "@/app/login/actions";

type NavItem = {
  href:   string;
  label:  string;
  icon:   React.ReactNode;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin",        label: "Negocios", icon: <Store   size={20} />, exact: false },
  { href: "/admin/planes", label: "Planes",   icon: <Package size={20} />, exact: true  },
];

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/restaurants");
  return pathname === href || pathname.startsWith(href + "/");
}

function getCurrentSection(pathname: string): string {
  if (pathname.startsWith("/admin/planes")) return "Planes";
  if (pathname.startsWith("/admin/restaurants")) return "Negocios";
  if (pathname === "/admin") return "Negocios";
  return "Administración";
}

interface AdminShellProps {
  userEmail: string;
  children:  React.ReactNode;
}

function ShellInner({ userEmail, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef   = useRef<HTMLButtonElement>(null);
  const drawerRef       = useRef<HTMLElement>(null);
  const emailInitials   = userEmail.slice(0, 2).toUpperCase();
  const sectionLabel    = getCurrentSection(pathname);

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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const NavLinks = () => (
    <>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
          >
            <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  const SidebarContent = () => (
    <>
      <div className="sb-brand-wrap">
        <Brand />
      </div>

      <div className="sb-biz-block">
        <div className="sb-biz-row">
          <div className="sidebar-avatar" style={{ background: "rgba(112,59,230,.45)" }}>
            <ShieldCheck size={16} />
          </div>
          <div className="sb-biz-info">
            <span className="sidebar-name">Plataforma Mesa</span>
            <span className="sidebar-role">Administrador</span>
          </div>
        </div>
      </div>

      <nav aria-label="Administración" className="sidebar-nav">
        <NavLinks />
      </nav>

      <div className="sidebar-bottom-v2">
        <div className="sb-user-row">
          <div className="sb-user-avatar">{emailInitials}</div>
          <span className="sidebar-bottom-email">{userEmail}</span>
        </div>
        <button
          className="sidebar-signout"
          onClick={async () => { await signOut(); }}
        >
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="dashboard">
      {/* Desktop sidebar */}
      <aside className="sidebar" aria-label="Navegación de administración">
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        {/* Mobile top bar */}
        <div className="panel-mobile-header">
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="admin-mobile-drawer"
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

        {/* Mobile drawer */}
        <nav
          id="admin-mobile-drawer"
          ref={drawerRef}
          aria-label="Navegación de administración"
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

          <div className="sb-biz-block">
            <div className="sb-biz-row">
              <div className="sidebar-avatar" style={{ background: "rgba(112,59,230,.45)" }}>
                <ShieldCheck size={16} />
              </div>
              <div className="sb-biz-info">
                <span className="sidebar-name">Plataforma Mesa</span>
                <span className="sidebar-role">Administrador</span>
              </div>
            </div>
          </div>

          <nav aria-label="Administración" className="sidebar-nav">
            <NavLinks />
          </nav>

          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="sb-user-row" style={{ marginBottom: 8 }}>
              <div className="sb-user-avatar">{emailInitials}</div>
              <span className="sidebar-bottom-email">{userEmail}</span>
            </div>
            <button
              className="sidebar-signout"
              onClick={async () => { await signOut(); }}
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </nav>

        {/* Shell header */}
        <div className="shell-header">
          <span className="shell-header-section">{sectionLabel}</span>
        </div>

        {children}
      </main>
    </div>
  );
}

export function AdminShell(props: AdminShellProps) {
  return <ShellInner {...props} />;
}
