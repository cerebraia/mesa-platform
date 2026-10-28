// Centralized commercial contact config for Mesa.
// Used by the landing page CTAs and FAB. Never import in /r/[slug] or /panel.

export const MESA_WA_PHONE = "584121983833";

// FAB flotante — consulta general
const FAB_MSG = "Hola, quiero información sobre Mesa y cómo crear mi catálogo digital.";
export const MESA_WA_HREF = `https://wa.me/${MESA_WA_PHONE}?text=${encodeURIComponent(FAB_MSG)}`;

// CTA principal — solicitar catálogo
const CTA_MSG = "Hola, quiero solicitar un catálogo digital para mi negocio.";
export const MESA_WA_CTA_HREF = `https://wa.me/${MESA_WA_PHONE}?text=${encodeURIComponent(CTA_MSG)}`;

// Helper para mensajes específicos (planes, etc.)
export function mesaWaHref(message: string): string {
  return `https://wa.me/${MESA_WA_PHONE}?text=${encodeURIComponent(message)}`;
}
