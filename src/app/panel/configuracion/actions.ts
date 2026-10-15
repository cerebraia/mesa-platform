"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMembershipForAction } from "@/lib/panel-context";
import type { PaymentType } from "@/lib/catalog-types";

// ── helpers ──────────────────────────────────────────────────

async function getOwnerMembership() {
  const supabase = await createServerClient();
  const { restaurantId } = await getActiveMembershipForAction({ requiredRole: "owner" });
  return { supabase, restaurantId };
}

function revalidateAll(restaurantId: string) {
  revalidatePath("/panel/configuracion");
  revalidatePath("/r/[slug]", "page");
}

// ── Config state type ─────────────────────────────────────────

export type ConfigState = { error: string | null; success?: boolean };

// ── Identity + Operation (calls save_restaurant_config RPC) ───

export async function saveConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!name) return { error: "El nombre del restaurante es obligatorio." };
  if (!timezone) return { error: "La zona horaria es obligatoria." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const config = {
    description:           String(formData.get("description") ?? ""),
    primary_color:         String(formData.get("primary_color") ?? "").trim() || "#703BE6",
    phone:                 String(formData.get("phone") ?? "").trim(),
    whatsapp:              String(formData.get("whatsapp") ?? "").trim(),
    instagram_url:         String(formData.get("instagram_url") ?? "").trim(),
    facebook_url:          String(formData.get("facebook_url") ?? "").trim(),
    twitter_url:           String(formData.get("twitter_url") ?? "").trim(),
    address:               String(formData.get("address") ?? "").trim(),
    pickup_enabled:        formData.get("pickup_enabled") === "true",
    pickup_address:        String(formData.get("pickup_address") ?? "").trim(),
    pickup_notes:          String(formData.get("pickup_notes") ?? "").trim(),
    delivery_enabled:      formData.get("delivery_enabled") === "true",
    is_temporarily_closed: formData.get("is_temporarily_closed") === "true",
    closed_message:        String(formData.get("closed_message") ?? "").trim(),
  };

  const { error } = await supabase.rpc("save_restaurant_config", {
    p_restaurant_id: restaurantId,
    p_name: name,
    p_timezone: timezone,
    p_config: config,
  });

  if (error) return { error: error.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

// ── Business hours ─────────────────────────────────────────────

export type HourInput = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
};

export async function saveHours(
  hours: HourInput[],
): Promise<ConfigState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Validate format
  for (const h of hours) {
    if (h.day_of_week < 0 || h.day_of_week > 6) return { error: "Día inválido." };
    if (!/^\d{2}:\d{2}$/.test(h.opens_at) || !/^\d{2}:\d{2}$/.test(h.closes_at)) {
      return { error: "Formato de hora inválido. Usa HH:MM." };
    }
  }

  const { error } = await supabase.rpc("save_business_hours", {
    p_restaurant_id: restaurantId,
    p_hours: hours,
  });

  if (error) return { error: error.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

// ── Config image (logo / cover) ────────────────────────────────

export async function saveConfigImage(
  field: "logo_path" | "cover_path",
  newPath: string,
): Promise<{ error: string | null; oldPath?: string }> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: oldPath, error } = await supabase.rpc("update_config_image", {
    p_restaurant_id: restaurantId,
    p_field: field,
    p_new_path: newPath,
  });

  if (error) {
    // New file was uploaded but DB update failed — caller must delete new file
    return { error: error.message };
  }

  // DB updated — safe to delete old file
  if (oldPath) {
    await supabase.storage.from("restaurant-assets").remove([oldPath as string]);
  }

  revalidateAll(restaurantId);
  return { error: null, oldPath: oldPath as string | undefined };
}

// ── Delivery zones ─────────────────────────────────────────────

export async function saveDeliveryZone(data: {
  id?: string;
  name: string;
  fee_cents: number;
  minimum_order_cents: number;
  position: number;
}): Promise<ConfigState> {
  if (!data.name.trim()) return { error: "El nombre de la zona es obligatorio." };
  if (data.fee_cents < 0) return { error: "La tarifa no puede ser negativa." };
  if (data.minimum_order_cents < 0) return { error: "El mínimo no puede ser negativo." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  let err: { message: string } | null = null;

  if (data.id) {
    const { error } = await supabase
      .from("delivery_zones")
      .update({
        name: data.name.trim(),
        fee_cents: data.fee_cents,
        minimum_order_cents: data.minimum_order_cents,
        position: data.position,
      })
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId);
    err = error;
  } else {
    const { error } = await supabase.from("delivery_zones").insert({
      restaurant_id: restaurantId,
      name: data.name.trim(),
      fee_cents: data.fee_cents,
      minimum_order_cents: data.minimum_order_cents,
      position: data.position,
    });
    err = error;
  }

  if (err) return { error: err.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

export async function setZoneActive(
  zoneId: string,
  active: boolean,
): Promise<ConfigState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("delivery_zones")
    .update({ is_active: active })
    .eq("id", zoneId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

// ── Payment methods ────────────────────────────────────────────

export async function savePaymentMethod(data: {
  id?: string;
  name: string;
  type: PaymentType;
  instructions: string;
  position: number;
}): Promise<ConfigState> {
  if (!data.name.trim()) return { error: "El nombre es obligatorio." };

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  let err: { message: string } | null = null;

  if (data.id) {
    const { error } = await supabase
      .from("payment_methods")
      .update({
        name: data.name.trim(),
        type: data.type,
        instructions: data.instructions.trim() || null,
        position: data.position,
      })
      .eq("id", data.id)
      .eq("restaurant_id", restaurantId);
    err = error;
  } else {
    const { error } = await supabase.from("payment_methods").insert({
      restaurant_id: restaurantId,
      name: data.name.trim(),
      type: data.type,
      instructions: data.instructions.trim() || null,
      position: data.position,
    });
    err = error;
  }

  if (err) return { error: err.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

export async function setPaymentActive(
  methodId: string,
  active: boolean,
): Promise<ConfigState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("payment_methods")
    .update({ is_active: active })
    .eq("id", methodId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidateAll(restaurantId);
  return { error: null, success: true };
}

// ── Domain management (owner) ─────────────────────────────────

// Host validation: matches the CHECK constraint in restaurant_domains.
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

export async function requestDomain(host: string): Promise<ConfigState> {
  const rawHost = host.trim().toLowerCase();

  if (!rawHost) return { error: "El dominio no puede estar vacío." };
  if (rawHost.length < 4 || rawHost.length > 253) {
    return { error: "El dominio debe tener entre 4 y 253 caracteres." };
  }
  if (rawHost.includes("..")) return { error: "El dominio contiene puntos consecutivos." };
  if (!HOST_RE.test(rawHost)) {
    return { error: "Formato de dominio inválido. Solo se permiten letras, dígitos, puntos y guiones." };
  }
  // Reject obviously reserved names
  const labels = rawHost.split(".");
  const first  = labels[0];
  if (["localhost", "supabase", "railway", "vercel"].includes(first)) {
    return { error: "Ese dominio no puede usarse en esta plataforma." };
  }

  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  let userId: string;
  try {
    const s = await createServerClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return { error: "No autenticado." };
    userId = user.id;
    const { data: m } = await s
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (m?.role !== "owner") return { error: "Solo los propietarios pueden solicitar dominios." };
    supabase = s;
    restaurantId = m.restaurant_id;
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase.from("restaurant_domains").insert({
    restaurant_id: restaurantId,
    host:          rawHost,
    kind:          "custom",
    status:        "requested",
    requested_by:  userId,
  });

  if (error) {
    if (error.code === "23505") return { error: "Este dominio ya está registrado en la plataforma." };
    return { error: error.message };
  }

  revalidatePath("/panel/configuracion");
  return { error: null, success: true };
}

export async function cancelDomainRequest(domainId: string): Promise<ConfigState> {
  let supabase: Awaited<ReturnType<typeof createServerClient>>;
  let restaurantId: string;
  try {
    ({ supabase, restaurantId } = await getOwnerMembership());
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("restaurant_domains")
    .delete()
    .eq("id", domainId)
    .eq("restaurant_id", restaurantId)
    .in("status", ["requested", "disconnected"]);

  if (error) return { error: error.message };

  revalidatePath("/panel/configuracion");
  return { error: null, success: true };
}
