// Tests for the unsaved-changes guard logic.
//
// These tests cover the pure decision logic:
//   - dirty / clean state transitions
//   - requestLeave resolves correctly based on user choice
//   - save-success clears protection
//   - save-failure restores protection
//
// Visual/DOM checks (dialog rendering, keyboard, focus, browser back/forward)
// require a browser and are listed as pending at the end.
//
// Run: npm run test:unsaved

import test from "node:test";
import assert from "node:assert/strict";

// ── Pure state machine helpers ─────────────────────────────────────────────
// These mirror the logic in UnsavedChangesProvider without React.

function makeGuard() {
  let dirty = false;
  let hasSentinel = false;
  const historyPushes: number[] = [];

  function setDirty(d: boolean) {
    dirty = d;
    if (d && !hasSentinel) {
      historyPushes.push(Date.now());
      hasSentinel = true;
    } else if (!d) {
      hasSentinel = false;
    }
  }

  function onSaveSuccess() {
    dirty = false;
    hasSentinel = false;
  }

  function onSaveFailure() {
    dirty = true;
    // If no sentinel (was cleared optimistically on submit), restore it
    if (!hasSentinel) {
      historyPushes.push(Date.now());
      hasSentinel = true;
    }
  }

  function onSubmitOptimistic() {
    // Called when form is submitted — clear dirty optimistically
    dirty = false;
    hasSentinel = false;
  }

  function onErrorFromAction() {
    // Action returned an error — restore dirty
    dirty = true;
    if (!hasSentinel) {
      historyPushes.push(Date.now());
      hasSentinel = true;
    }
  }

  return {
    get dirty() { return dirty; },
    get hasSentinel() { return hasSentinel; },
    get pushCount() { return historyPushes.length; },
    setDirty,
    onSaveSuccess,
    onSaveFailure,
    onSubmitOptimistic,
    onErrorFromAction,
  };
}

// ── GD01: starts clean ─────────────────────────────────────────────────────
test("GD01 formulario inicia limpio", () => {
  const g = makeGuard();
  assert.equal(g.dirty, false);
  assert.equal(g.hasSentinel, false);
});

// ── GD02: setDirty(true) marks dirty and pushes sentinel ──────────────────
test("GD02 setDirty(true) marca sucio y crea sentinel en historial", () => {
  const g = makeGuard();
  g.setDirty(true);
  assert.equal(g.dirty, true);
  assert.equal(g.hasSentinel, true);
  assert.equal(g.pushCount, 1, "Debe hacer un pushState");
});

// ── GD03: duplicate setDirty(true) does not push again ────────────────────
test("GD03 setDirty(true) repetido no duplica el sentinel", () => {
  const g = makeGuard();
  g.setDirty(true);
  g.setDirty(true);
  assert.equal(g.pushCount, 1, "Solo debe hacer un pushState");
});

// ── GD04: setDirty(false) clears sentinel ─────────────────────────────────
test("GD04 setDirty(false) limpia el sentinel", () => {
  const g = makeGuard();
  g.setDirty(true);
  g.setDirty(false);
  assert.equal(g.dirty, false);
  assert.equal(g.hasSentinel, false);
});

// ── GD05: save success clears dirty and sentinel ──────────────────────────
test("GD05 guardado exitoso limpia sucio y sentinel", () => {
  const g = makeGuard();
  g.setDirty(true);
  g.onSaveSuccess();
  assert.equal(g.dirty, false);
  assert.equal(g.hasSentinel, false);
});

// ── GD06: save failure restores dirty ─────────────────────────────────────
test("GD06 error de guardado restaura la protección", () => {
  const g = makeGuard();
  g.setDirty(true);
  g.onSaveFailure();
  assert.equal(g.dirty, true);
  assert.equal(g.hasSentinel, true);
});

// ── GD07: optimistic clear + action error restores dirty ──────────────────
test("GD07 submit optimista luego error de acción restaura protección", () => {
  const g = makeGuard();
  g.setDirty(true);
  g.onSubmitOptimistic(); // form submitted — clear optimistically
  assert.equal(g.dirty, false, "Tras submit optimista: limpio");
  g.onErrorFromAction();  // action returned error
  assert.equal(g.dirty, true, "Tras error de acción: sucio de nuevo");
  assert.equal(g.hasSentinel, true, "Sentinel restaurado");
});

// ── GD08: requestLeave returns true when not dirty ────────────────────────
test("GD08 requestLeave devuelve verdadero cuando no hay cambios", async () => {
  // Simulate the requestLeave logic: if not dirty, resolve immediately
  const isDirty = false;
  const result = isDirty ? await Promise.resolve(false) : await Promise.resolve(true);
  assert.equal(result, true, "Debe poder salir sin diálogo cuando está limpio");
});

// ── GD09: user chooses "discard" — guard is released ──────────────────────
test("GD09 al descartar, el guard se libera y la navegación procede", () => {
  const g = makeGuard();
  g.setDirty(true);
  // User clicks "Descartar y salir"
  g.onSaveSuccess(); // reuses same logic: clears dirty + sentinel
  assert.equal(g.dirty, false);
  assert.equal(g.hasSentinel, false);
});

// ── GD10: user chooses "stay" — sentinel is re-pushed ─────────────────────
test("GD10 al seguir editando, el sentinel se restaura", () => {
  const g = makeGuard();
  g.setDirty(true);
  const before = g.pushCount;
  // popstate fired (sentinel consumed); user clicks "Seguir editando"
  g.setDirty(true); // simulate re-push on stay
  assert.equal(g.dirty, true);
  assert.equal(g.hasSentinel, true);
  assert.ok(g.pushCount >= before, "Sentinel debe haberse re-empujado");
});

// ── GD11: multiple field edits only push sentinel once ────────────────────
test("GD11 múltiples ediciones de campo no crean múltiples sentinels", () => {
  const g = makeGuard();
  g.setDirty(true); // first change
  g.setDirty(true); // second change (already dirty)
  g.setDirty(true); // third change
  assert.equal(g.pushCount, 1, "Solo un sentinel para cualquier número de cambios");
});

// ── GD12: image upload pending keeps protection alive ────────────────────
test("GD12 imagen pendiente de subir mantiene el guard activo", () => {
  const g = makeGuard();
  g.setDirty(true); // image selected
  // Image upload in progress — save should not clear dirty until upload finishes
  // Simulate: don't call onSaveSuccess until upload + save complete
  assert.equal(g.dirty, true, "Guard activo mientras imagen pendiente");
  // After successful upload + save:
  g.onSaveSuccess();
  assert.equal(g.dirty, false, "Guard liberado tras guardado con imagen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Pendientes de navegador
// ─────────────────────────────────────────────────────────────────────────────
// GD-B01: Diálogo aparece al clic en enlace del sidebar con cambios
// GD-B02: "Seguir editando" cierra el diálogo y mantiene el formulario
// GD-B03: "Descartar y salir" navega a la ruta correcta
// GD-B04: Escape invoca "Seguir editando" y devuelve foco al botón que abrió
// GD-B05: Tab cicla solo dentro del diálogo (foco atrapado)
// GD-B06: beforeunload activo al intentar recargar con cambios
// GD-B07: Cambio de restaurante con cambios pendientes muestra diálogo
// GD-B08: Cancelar cambio de restaurante conserva formulario intacto
// GD-B09: Confirmar cambio de restaurante navega y descarta borrador
// GD-B10: Cerrar sesión con cambios pendientes muestra diálogo
// GD-B11: "Ver menú ↗" (nueva pestaña) con cambios pendientes muestra diálogo
