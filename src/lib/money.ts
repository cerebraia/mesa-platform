// Centralized money formatting for Mesa.
// All price display should route through formatMoney() so that the restaurant's
// currency is applied consistently everywhere.
//
// Historical orders/movements do not store a currency column; they use the
// restaurant's current currency as the best available approximation.
// Never invent conversion rates between currencies.

export const CURRENCIES: Record<string, { label: string; symbol: string }> = {
  USD: { label: "Dólar estadounidense — USD ($)", symbol: "$"   },
  EUR: { label: "Euro — EUR (€)",                 symbol: "€"   },
  VES: { label: "Bolívar — VES (Bs.)",            symbol: "Bs." },
};

export const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([code, v]) => ({
  code,
  label: v.label,
  symbol: v.symbol,
}));

/** Format a cent-amount with the restaurant's ISO-4217 currency code. */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    // Graceful fallback for unknown codes or environments without full ICU data.
    const sym = CURRENCIES[currency]?.symbol ?? currency;
    return `${sym}${(cents / 100).toFixed(2)}`;
  }
}
