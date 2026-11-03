"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Package, ShoppingCart, Settings, DollarSign, Users,
  Menu, X, LogOut, ShieldCheck, ArrowLeft, ExternalLink,
} from "lucide-react";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { signOut } from "@/app/login/actions";

interface ManageShellProps {
  restaurantId:   string;
  restaurantName: string;
  restaurantSlug: string;
  ordersEnabled:  boolean;
  logoUrl:        string | null;
  userEmail:      string;
  children:       React.ReactNode;
}

function ShellInner({
  restaurantId, restaurantName, restaurantSlug,
  ordersEnabled, logoUrl, userEmail, children,
}: ManageShellProps) {
  const pathname    = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef   = useRef<HTMLButtonElement>(null);
  const drawerRef       = useRef<HTMLElement>(null);
  const initials        = restaurantName.slice(0, 2).toUpperCase();
  const emailInitials   = userEmail.slice(0, 2).toUpperCase();

  const base = `/admin/restaurants/${restaurantId}/manage`;

  const NAV = [
    { href: `${base}/menu`,          label: "Catálogo",      icon: <Package size={20} /> },
    ...(ordersEnabled ? [{ href: `${base}/pedidos`, label: "Pedidos", icon: <ShoppingCart size={20} /> }] : []),
    { href: `${base}/configuracion`, label: "Configuración", icon: <Settings size={20} /> },
    { href: `${base}/finanzas`,      label: "Finanzas",      icon: <DollarSign size={20} /> },
    { href: `${base}/miembros`,      label: "Miembros",      icon: <Users size={20} /> },
  ];

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuButtonRef.current?.focus(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)
          && menuButtonRef.current && !menuButtonRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const NavLinks = () => (
    <>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`sidebar-link${isActive(item.href) ? " sidebar-link--active" : ""}`}
        >
          <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
          <span className="sidebar-link-label">{item.label}</span>
        </Link>
      ))}
    </>
  );

  const BizBlock = () => (
    <div className="sb-biz-block">
      <div className="sb-biz-row">
        {logoUrl ? (
          <img
            src={logoUrl} alt=""
            style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "#fff" }}
          />
        ) : (
          <div className="sidebar-avatar">{initials}</div>
        )}
        <div className="sb-biz-info">
          <span className="sidebar-name" style={{ fontSize: 12 }}>{restaurantName}</span>
          <span className="sidebar-role" style={{ color: "#a78bfa" }}>Administrando</span>
        </div>
      </div>
    </div>
  );

  const SidebarContent = () => (
    <>
      <div className="sb-brand-wrap">
        <Brand />
      </div>

      {/* Admin indicator */}
      <div style={{
        margin: "0 12px 8px",
        padding: "6px 10px",
        background: "rgba(112,59,230,.18)",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <ShieldCheck size={13} color="#a78bfa" />
        <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>Admin</span>
      </div>

      <BizBlock />

      <nav aria-label={`Administración de ${restaurantName}`} className="sidebar-nav">
        <NavLinks />
      </nav>

      {/* Bottom links */}
      <div className="sidebar-bottom-v2">
        <Link
          href={`/admin/restaurants/${restaurantId}`}
          style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "#a78bfa", padding: "6px 0", marginBottom: 8 }}
        >
          <ArrowLeft size={13} />
          Volver a negocios
        </Link>
        <a
          href={`/r/${restaurantSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "#94a3b8", padding: "6px 0", marginBottom: 12 }}
        >
          <ExternalLink size={13} />
          Ver catálogo público
        </a>
        <div className="sb-user-row">
          <div className="sb-user-avatar">{emailInitials}</div>
          <span className="sidebar-bottom-email">{userEmail}</span>
        </div>
        <button className="sidebar-signout" onClick={async () => { await signOut(); }}>
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  const currentLabel = NAV.find((n) => isActive(n.href))?.label ?? "Gestión";

  return (
    <div className="dashboard">
      <aside className="sidebar" aria-label={`Administración de ${restaurantName}`}>
        <SidebarContent />
      </aside>

      <main className="dashboard-main">
        <div className="panel-mobile-header">
          <Brand />
          <button
            ref={menuButtonRef}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="manage-mobile-drawer"
            className="panel-mobile-menu-btn"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <div className="panel-drawer-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
        )}

        <nav
          id="manage-mobile-drawer"
          ref={drawerRef}
          aria-label={`Navegación ${restaurantName}`}
          className={`panel-mobile-drawer${open ? " panel-mobile-drawer--open" : ""}`}
          aria-hidden={!open}
        >
          <div className="panel-drawer-close-row">
            <Brand />
            <button aria-label="Cerrar menú" className="panel-mobile-menu-btn" onClick={() => setOpen(false)}>
              <X size={22} />
            </button>
          </div>
          <BizBlock />
          <nav aria-label={`Administración de ${restaurantName}`} className="sidebar-nav">
            <NavLinks />
          </nav>
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <Link
              href={`/admin/restaurants/${restaurantId}`}
              style={{ display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "#a78bfa", padding: "6px 0", marginBottom: 8 }}
            >
              <ArrowLeft size={13} />
              Volver a negocios
            </Link>
            <div className="sb-user-row" style={{ marginBottom: 8 }}>
              <div className="sb-user-avatar">{emailInitials}</div>
              <span className="sidebar-bottom-email">{userEmail}</span>
            </div>
            <button className="sidebar-signout" onClick={async () => { await signOut(); }}>
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </nav>

        <div className="shell-header">
          <span className="shell-header-section">{currentLabel}</span>
          <span style={{ fontSize: 12, color: "#a78bfa", marginLeft: "auto", paddingRight: 16 }}>
            {restaurantName}
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}

export function ManageShell(props: ManageShellProps) {
  return <ShellInner {...props} />;
}
