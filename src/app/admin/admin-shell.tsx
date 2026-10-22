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
  href:  string;
  label: string;
  icon:  React.ReactNode;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin",        label: "Restaurantes", icon: <Store   size={16} />, exact: false },
  { href: "/admin/planes", label: "Planes",       icon: <Package size={16} />, exact: true  },
];

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/restaurants");
  return pathname === href || pathname.startsWith(href + "/");
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
  const initials        = userEmail.slice(0, 2).toUpperCase();

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
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="dashboard">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-workspace">
          <div className="sidebar-avatar" style={{ background: "rgba(112,59,230,.35)" }}>
            <ShieldCheck size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="sidebar-name">Plataforma Mesa</span>
            <span className="sidebar-role">Administrador</span>
          </div>
        </div>
        <nav aria-label="Administración" className="sidebar-nav">
          <NavLinks />
        </nav>
        <div className="sidebar-bottom-v2">
          <span className="sidebar-bottom-email">{userEmail}</span>
          <button
            className="sidebar-signout"
            onClick={async () => { await signOut(); }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main" style={{ minWidth: 0 }}>
        {/* Mobile header */}
        <div className="panel-mobile-header">
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="admin-mobile-drawer"
            onClick={() => setOpen((v) => !v)}
            className="panel-mobile-menu-btn"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <nav
            id="admin-mobile-drawer"
            ref={drawerRef}
            aria-label="Navegación de administración"
            className="panel-mobile-drawer"
          >
            <div className="sidebar-workspace" style={{ margin: "0 0 8px" }}>
              <div className="sidebar-avatar" style={{ background: "rgba(112,59,230,.35)" }}>
                <ShieldCheck size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="sidebar-name">Plataforma Mesa</span>
                <span className="sidebar-role">Administrador</span>
              </div>
            </div>
            <NavLinks />
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <span className="sidebar-bottom-email" style={{ display: "block", marginBottom: 10 }}>
                {userEmail}
              </span>
              <button
                className="sidebar-signout"
                onClick={async () => { await signOut(); }}
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          </nav>
        )}

        {children}
      </main>
    </div>
  );
}

export function AdminShell(props: AdminShellProps) {
  return <ShellInner {...props} />;
}
