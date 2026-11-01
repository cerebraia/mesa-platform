import Link from "next/link";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

// ── Brand ──────────────────────────────────────────────────────
// Three variants share the same CSS classes (.brand, .brand-icon).
// Dark-background variants are handled by CSS context selectors:
//   .sidebar .brand-*  and  .panel-mobile-header .brand-*

/** Full horizontal wordmark — use on light backgrounds. */
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={`${BRAND_NAME}, inicio`}>
      <span className="brand-icon" aria-hidden="true">W</span>
      {BRAND_NAME}
    </Link>
  );
}

/** One-line slogan — for marketing contexts only. */
export function BrandSlogan() {
  return <span className="brand-slogan">{BRAND_SLOGAN}</span>;
}

export function DemoNotice() {
  return (
    <div className="demo-notice">
      Vista de demostración · Datos ficticios · Sin conexión a Supabase
    </div>
  );
}
