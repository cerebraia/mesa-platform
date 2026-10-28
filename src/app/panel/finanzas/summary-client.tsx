"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MovementForm } from "./movement-form";

interface SummaryClientProps {
  restaurantId: string;
  currency:     string;
  stockEnabled: boolean;
  categories:   string[];
  products:     { id: string; name: string }[];
}

export function FinanciasSummaryClient({
  restaurantId,
  currency,
  stockEnabled,
  categories,
  products,
}: SummaryClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  function handleSaved() {
    setShowForm(false);
    router.refresh();
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="button"
          onClick={() => setShowForm(true)}
        >
          <Plus size={14} />
          Registrar movimiento
        </button>
      </div>

      {showForm && (
        <MovementForm
          restaurantId={restaurantId}
          currency={currency}
          stockEnabled={stockEnabled}
          categories={categories}
          products={products}
          onSaved={handleSaved}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
