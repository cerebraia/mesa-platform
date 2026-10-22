// Single source of truth for Mesa commercial plan data.
// These values are seeded into the database by migration 023.
// Any UI that displays plan information MUST use this file — never hardcode
// prices or limits elsewhere to avoid contradictions.

export type PlanCode = "inicio" | "negocio" | "acompanado";

export interface PlanDefinition {
  code:              PlanCode;
  name:              string;
  price_cents:       number;
  currency:          string;
  max_products:      number;
  max_members:       number;
  allowed_roles:     string[];
  description_short: string;
  features:          string[];
  badge?:            string;
  contact_subject:   string;
}

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    code:         "inicio",
    name:         "Mesa Inicio",
    price_cents:  1900,
    currency:     "USD",
    max_products: 50,
    max_members:  1,
    allowed_roles: ["owner"],
    description_short: "Todo lo que necesitas para publicar tu menú y recibir pedidos.",
    features: [
      "Hasta 50 productos con fotos, variantes y extras",
      "Carrito y pedidos para clientes",
      "Horarios, retiro en local y zonas de delivery",
      "Métodos de pago manuales",
      "Gestión de pedidos y resumen de ventas",
      "1 usuario (propietario)",
      "Soporte estándar",
    ],
    contact_subject: "Solicitud de plan: Mesa Inicio",
  },
  {
    code:         "negocio",
    name:         "Mesa Negocio",
    price_cents:  3900,
    currency:     "USD",
    max_products: 200,
    max_members:  5,
    allowed_roles: ["owner", "attention", "kitchen"],
    description_short: "Para equipos que necesitan más espacio y roles especializados.",
    badge: "Recomendado",
    features: [
      "Hasta 200 productos con fotos, variantes y extras",
      "Hasta 5 usuarios: propietario, atención y cocina",
      "Todo lo de Mesa Inicio",
      "Roles de atención y cocina con vistas dedicadas",
      "Indicadores operativos por período",
      "Opción de dominio propio (pendiente de infraestructura)",
      "Soporte estándar",
    ],
    contact_subject: "Solicitud de plan: Mesa Negocio",
  },
  {
    code:         "acompanado",
    name:         "Mesa Acompañado",
    price_cents:  6900,
    currency:     "USD",
    max_products: 400,
    max_members:  10,
    allowed_roles: ["owner", "attention", "kitchen"],
    description_short: "Más capacidad y ayuda directa de nuestro equipo para tu catálogo.",
    features: [
      "Hasta 400 productos con fotos, variantes y extras",
      "Hasta 10 usuarios: propietario, atención y cocina",
      "Todo lo de Mesa Negocio",
      "Hasta 10 cambios de catálogo al mes por nuestro equipo",
      "Soporte prioritario en horario laboral",
    ],
    contact_subject: "Solicitud de plan: Mesa Acompañado",
  },
] as const;

export function getPlanByCode(code: string | null | undefined): PlanDefinition | null {
  if (!code) return null;
  return PLAN_CATALOG.find((p) => p.code === code) ?? null;
}

export function formatPlanPrice(plan: PlanDefinition): string {
  return `${(plan.price_cents / 100).toFixed(0)} USD`;
}
