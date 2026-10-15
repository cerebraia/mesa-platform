"use client";

import { useTransition } from "react";
import { UnsavedAwareButton } from "@/components/unsaved-changes";
import { selectRestaurant } from "./select-restaurant";
import type { MembershipOption } from "@/lib/panel-context";

interface Props {
  options:           MembershipOption[];
  activeRestaurantId: string;
}

export function RestaurantSwitcher({ options, activeRestaurantId }: Props) {
  const [, startTransition] = useTransition();

  return (
    <div className="dashboard-card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Cambiar restaurante</h2>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Al cambiar se descartará cualquier edición en curso en este restaurante.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const isCurrent = opt.restaurantId === activeRestaurantId;
          return (
            <UnsavedAwareButton
              key={opt.restaurantId}
              className={isCurrent ? "button small" : "button secondary small"}
              style={{ fontSize: 12 }}
              disabled={isCurrent}
              onClick={() => {
                startTransition(async () => {
                  await selectRestaurant(opt.restaurantId);
                });
              }}
            >
              {opt.restaurantName}
              {isCurrent && " ✓"}
            </UnsavedAwareButton>
          );
        })}
      </div>
    </div>
  );
}
