"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Brand } from "./brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on route change or Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <header className="site-header container" style={{ position: "relative" }}>
      <Brand />

      {/* Desktop nav */}
      <nav aria-label="Principal" className="site-desktop-nav">
        <a href="#funciones">Funciones</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#planes">Planes</a>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="button small secondary site-desktop-nav" href="/login">
          Ingresar
        </Link>

        {/* Hamburger — mobile only */}
        <button
          ref={btnRef}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="site-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="site-mobile-menu-btn"
          style={{
            display:    "none",
            background: "none",
            border:     "none",
            cursor:     "pointer",
            padding:    "8px",
            fontSize:   22,
            color:      "var(--ink)",
            lineHeight: 1,
          }}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav
          id="site-mobile-menu"
          aria-label="Navegación principal"
          style={{
            position:       "absolute",
            top:            "100%",
            left:           0,
            right:          0,
            background:     "white",
            border:         "1px solid var(--border)",
            borderTop:      "none",
            boxShadow:      "0 8px 24px #3924500d",
            zIndex:         50,
            display:        "flex",
            flexDirection:  "column",
            padding:        "12px 0",
          }}
        >
          {[
            { href: "#funciones",      label: "Funciones" },
            { href: "#como-funciona",  label: "Cómo funciona" },
            { href: "#planes",         label: "Planes" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                padding:        "12px 24px",
                fontSize:       14,
                color:          "var(--ink)",
                textDecoration: "none",
              }}
            >
              {item.label}
            </a>
          ))}
          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", marginTop: 4 }}>
            <Link
              href="/login"
              className="button small"
              style={{ width: "100%" }}
              onClick={() => setOpen(false)}
            >
              Ingresar al panel
            </Link>
          </div>
        </nav>
      )}

      <style>{`
        @media (max-width: 760px) {
          .site-desktop-nav { display: none !important; }
          .site-mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
}
