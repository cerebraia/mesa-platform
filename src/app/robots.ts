// robots.ts — instructs crawlers which paths to exclude.
//
// Important: robots.txt is a convention, NOT a security gate.
// Private routes (/panel, /admin) are protected by authentication and
// authorization middleware — robots.txt is only advisory.
//
// Per-restaurant noindex is handled in generateMetadata for /r/[slug],
// not here, so crawlers can still discover the sitemap URL.

import type { MetadataRoute } from "next";
import { getPlatformBase } from "@/lib/canonical";

export default function robots(): MetadataRoute.Robots {
  const base = getPlatformBase();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/panel",
          "/panel/",
          "/admin",
          "/admin/",
          "/login",
          "/seleccionar-negocio",
          // Order-confirmation pages contain session data and are not indexable
          "/r/*/pedido",
          "/r/*/pedido/",
        ],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
