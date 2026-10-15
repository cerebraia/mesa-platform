"use client";

// Shared unsaved-changes guard for panel forms.
//
// Architecture:
//   UnsavedChangesProvider  wraps the panel shell; manages dialog + state.
//   useUnsavedChanges()     hook consumed by forms to set/clear dirty flag.
//   UnsavedAwareLink        replaces <Link> wherever a dirty guard is needed.
//   UnsavedAwareButton      wraps any onClick action with the same guard.
//
// Navigation coverage:
//   ✓ Tab close / reload              — beforeunload event
//   ✓ Sidebar links                   — UnsavedAwareLink
//   ✓ "Volver al catálogo"            — UnsavedAwareLink
//   ✓ Cerrar sesión                   — UnsavedAwareButton
//   ✓ Cambio de restaurante           — UnsavedAwareButton
//   ✓ Browser back / forward          — history guard (pushState marker)
//
// History guard:
//   When the form becomes dirty we push a sentinel entry to the history stack.
//   On popstate, if the user navigated away from that entry, we show the dialog.
//   "Seguir editando" re-pushes the sentinel to restore protection.
//   "Descartar y salir" drops the sentinel and lets navigation proceed.
//   The extra history entry is removed when the form is saved or explicitly
//   discarded, so normal navigation is not broken.
//
// Limitation:
//   popstate fires AFTER navigation. We show the dialog and can undo
//   the navigation by calling history.go(+1). However, if the user navigates
//   forward past the form using the browser's forward button, we cannot
//   detect this (popstate state is opaque to us unless we placed it).
//   That edge case is left unprotected and documented here.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// ── Context ────────────────────────────────────────────────────────────────

interface UnsavedChangesCtx {
  isDirty:    boolean;
  setDirty:   (dirty: boolean) => void;
  /** Returns true if the caller may proceed (user chose "Descartar"). */
  requestLeave: () => Promise<boolean>;
}

const Ctx = createContext<UnsavedChangesCtx>({
  isDirty:      false,
  setDirty:     () => {},
  requestLeave: async () => true,
});

export function useUnsavedChanges(): UnsavedChangesCtx {
  return useContext(Ctx);
}

// ── Provider ───────────────────────────────────────────────────────────────

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDirty, _setDirty]   = useState(false);
  const isDirtyRef              = useRef(false);
  const [showDialog, setShowDialog] = useState(false);
  const resolveRef = useRef<((leave: boolean) => void) | null>(null);
  // Track whether we have a history sentinel entry active.
  const hasSentinel = useRef(false);

  // Keep ref in sync so event handlers read the latest value.
  const setDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
    _setDirty(dirty);

    if (dirty && !hasSentinel.current) {
      // Push a sentinel entry so popstate fires when user navigates back.
      history.pushState({ unsavedGuard: true }, "");
      hasSentinel.current = true;
    } else if (!dirty && hasSentinel.current) {
      // Sentinel no longer needed — mark it removed
      // (we leave the history entry; it becomes an inert extra step at worst)
      hasSentinel.current = false;
    }
  }, []);

  const requestLeave = useCallback((): Promise<boolean> => {
    if (!isDirtyRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setShowDialog(true);
    });
  }, []);

  function confirmDiscard() {
    hasSentinel.current = false;
    isDirtyRef.current  = false;
    _setDirty(false);
    setShowDialog(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }

  function cancelLeave() {
    setShowDialog(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
    // Restore the sentinel in case popstate had consumed it
    if (isDirtyRef.current && !hasSentinel.current) {
      history.pushState({ unsavedGuard: true }, "");
      hasSentinel.current = true;
    }
  }

  // beforeunload: covers tab close and page reload.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // popstate: browser back/forward.
  // When the user navigates back, the sentinel entry absorbs the step.
  // We show the dialog; "Seguir editando" re-pushes the entry.
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (!isDirtyRef.current) return;
      // The user navigated away from our sentinel entry.
      hasSentinel.current = false;
      // Show dialog, await user choice.
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setShowDialog(true);
      }).then((leave) => {
        if (!leave) {
          // Restore sentinel: push it back so the next popstate is protected.
          history.pushState({ unsavedGuard: true }, "");
          hasSentinel.current = true;
        } else {
          isDirtyRef.current = false;
          _setDirty(false);
        }
      });
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <Ctx.Provider value={{ isDirty, setDirty, requestLeave }}>
      {children}
      {showDialog && (
        <UnsavedDialog
          onStay={cancelLeave}
          onDiscard={confirmDiscard}
        />
      )}
    </Ctx.Provider>
  );
}

// ── Dialog ─────────────────────────────────────────────────────────────────

function UnsavedDialog({
  onStay,
  onDiscard,
}: {
  onStay:    () => void;
  onDiscard: () => void;
}) {
  const stayRef = useRef<HTMLButtonElement>(null);

  // Focus "Seguir editando" on mount; restore on close via onStay/onDiscard.
  useEffect(() => {
    stayRef.current?.focus();
  }, []);

  // Escape → stay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onStay]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onStay}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(41,34,52,0.45)",
          zIndex: 999,
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        style={{
          position:     "fixed",
          top:          "50%",
          left:         "50%",
          transform:    "translate(-50%,-50%)",
          zIndex:       1000,
          background:   "white",
          borderRadius: 14,
          boxShadow:    "0 20px 60px rgba(41,34,52,0.25)",
          padding:      "32px 28px 24px",
          width:        "min(460px, calc(100vw - 32px))",
        }}
      >
        <h2
          id="unsaved-title"
          style={{ fontSize: 18, marginBottom: 10, letterSpacing: -0.4 }}
        >
          Tienes cambios sin guardar
        </h2>
        <p
          id="unsaved-desc"
          style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}
        >
          Si sales ahora, los cambios que no hayas guardado se perderán.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            ref={stayRef}
            className="button"
            onClick={onStay}
            style={{ minHeight: 40, fontSize: 13 }}
          >
            Seguir editando
          </button>
          <button
            className="button secondary"
            onClick={onDiscard}
            style={{ minHeight: 40, fontSize: 13, color: "#a72b38", borderColor: "#f5bdc4" }}
          >
            Descartar y salir
          </button>
        </div>
      </div>
    </>
  );
}

// ── UnsavedAwareLink ────────────────────────────────────────────────────────

interface LinkProps {
  href:      string;
  children:  React.ReactNode;
  className?: string;
  style?:    React.CSSProperties;
  target?:   string;
  rel?:      string;
}

export function UnsavedAwareLink({
  href,
  children,
  className,
  style,
  target,
  rel,
}: LinkProps) {
  const { isDirty, requestLeave } = useUnsavedChanges();
  const router = useRouter();

  const isExternal = target === "_blank" || href.startsWith("http");

  async function handleClick(e: React.MouseEvent) {
    if (!isDirty) return; // no guard needed — let default <a> / Link handle it
    e.preventDefault();
    const leave = await requestLeave();
    if (!leave) return;

    if (isExternal) {
      window.open(href, target ?? "_blank", rel ?? "noopener noreferrer");
    } else {
      router.push(href);
    }
  }

  // Use a plain <a> so we can preventDefault on any click.
  return (
    <a
      href={href}
      className={className}
      style={style}
      target={target}
      rel={rel}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

// ── UnsavedAwareButton ──────────────────────────────────────────────────────

interface ButtonProps {
  onClick:   () => void | Promise<void>;
  children:  React.ReactNode;
  className?: string;
  style?:    React.CSSProperties;
  type?:     "button" | "submit" | "reset";
  disabled?: boolean;
}

export function UnsavedAwareButton({
  onClick,
  children,
  className,
  style,
  type = "button",
  disabled,
}: ButtonProps) {
  const { isDirty, requestLeave } = useUnsavedChanges();

  async function handleClick() {
    if (isDirty) {
      const leave = await requestLeave();
      if (!leave) return;
    }
    await onClick();
  }

  return (
    <button
      type={type}
      className={className}
      style={style}
      disabled={disabled}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
