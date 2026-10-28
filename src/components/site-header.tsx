"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Brand } from "./brand";

const NAV_ITEMS = [
  { href: "#funciones",     label: "Funciones"     },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#demos",         label: "Demostración"  },
  { href: "#planes",        label: "Planes"        },
];

export function SiteHeader({ requestHref }: { requestHref?: string }) {
  const [open, setOpen]         = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`lp-header container${scrolled ? " lp-header--scrolled" : ""}`}
      style={{ position: "relative" }}
    >
      <Brand />

      <nav aria-label="Principal" className="lp-nav">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href}>{item.label}</a>
        ))}
      </nav>

      <div className="lp-header-actions">
        <Link className="button small secondary lp-nav" href="/login">
          Ingresar
        </Link>
        {requestHref && (
          <a className="button small lp-nav" href={requestHref}>
            Solicitar catálogo
          </a>
        )}
        <button
          ref={btnRef}
          className="lp-mobile-btn"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <nav id="lp-mobile-menu" aria-label="Navegación principal" className="lp-mobile-menu">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <div className="lp-mobile-menu-footer">
            <Link href="/login" className="button small secondary full" onClick={() => setOpen(false)}>
              Ingresar al panel
            </Link>
            {requestHref && (
              <a href={requestHref} className="button small full" onClick={() => setOpen(false)}>
                Solicitar catálogo
              </a>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
