// Database types for catalog entities.
// All monetary values are in cents (integer).

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  promo_price_cents: number | null;
  is_available: boolean;
  is_published: boolean;
  position: number;
  // Added in migration 026. null → 'cover' (default). 'contain' → show full product.
  image_fit: string | null;
  // Added in migration 032. null = active; non-null = soft-deleted (excluded from public queries).
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  restaurant_id: string;
  storage_path: string;
  // Added in migration 027. If set, used as the card thumbnail.
  thumbnail_path: string | null;
  alt_text: string | null;
  position: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  restaurant_id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  position: number;
}

export interface OptionGroup {
  id: string;
  product_id: string;
  restaurant_id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  position: number;
}

export interface Option {
  id: string;
  option_group_id: string;
  restaurant_id: string;
  name: string;
  price_delta_cents: number;
  is_available: boolean;
  position: number;
}

// Form payloads sent to upsert_product RPC
export interface VariantInput {
  name: string;
  price_cents: number;
  is_available?: boolean;
}

export interface OptionInput {
  name: string;
  price_delta_cents?: number;
  is_available?: boolean;
}

export interface OptionGroupInput {
  name: string;
  min_selections: number;
  max_selections: number;
  options: OptionInput[];
}

export interface ProductInput {
  id?: string;
  category_id: string;
  name: string;
  description?: string;
  base_price_cents: number;
  promo_price_cents?: number;
  is_available?: boolean;
  is_published?: boolean;
  position?: number;
  image_fit?: string;
}

// ── Public menu types ─────────────────────────────────────────
// These interfaces match exactly what the anon role can SELECT
// after migrations 008-009 (column-level security).
// They do NOT include timestamps, status flags (is_active, is_published,
// is_available), or configuration (timezone). RLS already enforces
// that only active/published rows are returned.

export interface PublicProductImage {
  id: string;
  product_id: string;
  restaurant_id: string;
  storage_path: string;
  // Added in migration 027. Card uses this when available.
  thumbnail_path?: string | null;
  alt_text: string | null;
  position: number;
}

export interface PublicProductVariant {
  id: string;
  product_id: string;
  restaurant_id: string;
  name: string;
  price_cents: number;
  position: number;
}

export interface PublicOption {
  id: string;
  option_group_id: string;
  restaurant_id: string;
  name: string;
  price_delta_cents: number;
  position: number;
}

export interface PublicOptionGroup {
  id: string;
  product_id: string;
  restaurant_id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  position: number;
  options: PublicOption[];
}

export interface PublicProduct {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  promo_price_cents: number | null;
  position: number;
  // Added in migration 026. null → cover. 'contain' → show full product without cropping.
  image_fit?: string | null;
  product_images: PublicProductImage[];
  product_variants: PublicProductVariant[];
  option_groups: PublicOptionGroup[];
}

export interface PublicCategory {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
  products: PublicProduct[];
}

// ── Restaurant configuration types ────────────────────────────

export interface RestaurantConfig {
  restaurant_id: string;
  description: string | null;
  logo_path: string | null;
  cover_path: string | null;
  primary_color: string | null;
  // Added in migration 025.
  background_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  address: string | null;
  pickup_enabled: boolean;
  pickup_address: string | null;
  pickup_notes: string | null;
  delivery_enabled: boolean;
  is_temporarily_closed: boolean;
  closed_until: string | null;
  closed_message: string | null;
  // Added in migration 024. DEFAULT true.
  orders_enabled: boolean;
  // Added in migration 030. DEFAULT false.
  stock_tracking_enabled?: boolean;
  updated_at: string;
}

export interface BusinessHour {
  id: string;
  restaurant_id: string;
  day_of_week: number; // 0=Sun…6=Sat
  opens_at: string;    // "HH:MM"
  closes_at: string;   // "HH:MM" — if < opens_at, crosses midnight
  is_active: boolean;
}

export interface DeliveryZone {
  id: string;
  restaurant_id: string;
  name: string;
  fee_cents: number;
  minimum_order_cents: number;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export type PaymentType = "cash" | "transfer" | "mobile_payment" | "card" | "other";

export interface PaymentMethod {
  id: string;
  restaurant_id: string;
  name: string;
  type: PaymentType;
  instructions: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

// Public-facing config: anon can read these fields (migrations 012 + 024 + 025 grants).
// payment_methods.instructions is NOT included — private.
export interface PublicRestaurantConfig {
  restaurant_id: string;
  description: string | null;
  logo_path: string | null;
  cover_path: string | null;
  primary_color: string | null;
  // Added in migration 025.
  background_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  address: string | null;
  pickup_enabled: boolean;
  pickup_address: string | null;
  pickup_notes: string | null;
  delivery_enabled: boolean;
  is_temporarily_closed: boolean;
  closed_message: string | null;
  // Added in migration 024. DEFAULT true → negocios existentes conservan pedidos.
  orders_enabled: boolean;
}

export interface PublicDeliveryZone {
  id: string;
  restaurant_id: string;
  name: string;
  fee_cents: number;
  minimum_order_cents: number;
  position: number;
}

export interface PublicPaymentMethod {
  id: string;
  restaurant_id: string;
  name: string;
  type: string;
  position: number;
}

// ── Order types ───────────────────────────────────────────────

export type OrderStatus =
  | "received" | "accepted" | "preparing"
  | "ready" | "on_the_way" | "completed"
  | "rejected" | "cancelled";

export type PaymentStatus = "pending" | "confirmed" | "refunded";

// Cart item built client-side before checkout
export interface CartEntry {
  key: string;                 // selectionKey — unique per configuration
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  options: CartOption[];
  quantity: number;
  unitPriceCents: number;      // display only — server recomputes
}

export interface CartOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

// Payload sent to POST /api/orders
export interface PlaceOrderRequest {
  restaurantId: string;
  idempotencyKey: string;
  acknowledgedTotalCents: number;
  customerName: string;
  customerPhone: string;
  modality: "pickup" | "delivery";
  deliveryZoneId: string | null;
  deliveryAddress: string;
  paymentMethodId: string;
  notes: string;
  items: PlaceOrderItem[];
}

export interface PlaceOrderItem {
  productId: string;
  variantId: string | null;
  options: { optionGroupId: string; optionId: string }[];
  quantity: number;
}

// Server response on success — token is delivered via Set-Cookie, never in body
export interface PlaceOrderResponse {
  orderNumber: number;
  redirectTo: string;   // cookie-protected path, no token
  totalCents: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  status: OrderStatus;
  paymentMethodName: string;
}

// Server response when price changed
export interface PriceChangedResponse {
  priceChanged: true;
  actualTotalCents: number;
  actualSubtotalCents: number;
  actualDeliveryFeeCents: number;
}

// Confirmation page data from get_order_by_token
export interface OrderConfirmation {
  id: string;
  orderNumber: number;
  restaurantId: string;
  modality: "pickup" | "delivery";
  deliveryZoneName: string | null;
  deliveryAddress: string | null;
  deliveryFeeCents: number;
  paymentMethodName: string | null;
  paymentMethodType: string | null;
  paymentInstructions: string | null;
  notes: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  totalCents: number;
  createdAt: string;
  items: OrderConfirmationItem[];
}

export interface OrderConfirmationItem {
  id: string;
  productName: string;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  options: OrderConfirmationOption[];
}

export interface OrderConfirmationOption {
  optionGroupName: string;
  optionName: string;
  priceDeltaCents: number;
}

// ── Finance types (migration 028) ────────────────────────────

export type FinancialMovement = {
  id: string;
  restaurant_id: string;
  type: 'income' | 'expense' | 'purchase';
  amount_cents: number;
  currency: string;
  concept: string;
  category: string | null;
  movement_date: string;
  notes: string | null;
  reference: string | null;
  counterpart: string | null;
  product_id: string | null;
  units: number | null;
  is_voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  created_by: string;
  created_at: string;
};

export type FinancialSummary = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  currency: string;
  movement_count: number;
};

export type StockAdjustmentLog = {
  id: string;
  restaurant_id: string;
  product_id: string;
  variant_id: string | null;
  delta: number;
  reason: string | null;
  new_quantity: number;
  created_by: string;
  created_at: string;
};
