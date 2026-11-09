import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getBizBrand, type BizBrand } from "@/lib/biz-brand";
import { selectRestaurant } from "@/app/panel/select-restaurant";
import { Brand } from "@/components/brand";
import Link from "next/link";
import LoginForm from "./login-form";
import type { Metadata } from "next";

type Props = { searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp      = await searchParams;
  const negocio = sp.negocio ?? "";
  if (negocio) {
    const brand = await getBizBrand(negocio);
    if (brand) return { title: `Acceder a ${brand.name} — Wacatalog` };
  }
  return { title: "Iniciar sesión — Wacatalog" };
}

export default async function LoginPage({ searchParams }: Props) {
  const sp      = await searchParams;
  const negocio = sp.negocio ?? "";

  let brand: BizBrand | null = null;
  if (negocio) {
    brand = await getBizBrand(negocio);
  }

  // Already-authenticated user visiting a business login link.
  // The proxy lets this request through when negocio is present.
  if (brand) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: membership } = await supabase
        .from("restaurant_members")
        .select("restaurant_id")
        .eq("user_id", user.id)
        .eq("restaurant_id", brand.restaurantId)
        .eq("status", "active")
        .maybeSingle();

      if (membership) {
        // Valid membership — select the business and open the panel.
        await selectRestaurant(brand.restaurantId);
        redirect("/panel");
      }

      // Logged in but no membership in this business.
      return <NoAccessPage brand={brand} />;
    }
  }

  // Render the form (branded if brand is resolved, standard otherwise).
  return (
    <LoginForm
      brand={brand}
      negocio={brand ? negocio : ""}
    />
  );
}

// ── No-access screen for already-authenticated users ──────────────────────────
// Server-rendered; no form state needed.

function NoAccessPage({ brand }: { brand: BizBrand }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Compact business indicator */}
        <div
          className="bl-noaccess-biz"
          style={{ background: brand.primaryColor, color: brand.textColor }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="bl-noaccess-logo" />
          ) : (
            <span className="bl-noaccess-initials">
              {brand.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="bl-noaccess-name">{brand.name}</span>
        </div>

        <Brand />
        <h1 style={{ marginTop: 20 }}>Sin acceso</h1>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 24px" }}>
          Tu cuenta no tiene acceso a este negocio.
        </p>

        <Link href="/login" className="button full" style={{ textAlign: "center" }}>
          Ir al acceso general
        </Link>

        <p className="muted" style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>
          <a href={brand.catalogUrl} className="text-link" style={{ fontSize: 12 }}>
            ← Ver catálogo de {brand.name}
          </a>
        </p>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
