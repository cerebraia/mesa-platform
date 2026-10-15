"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PERIODS = [
  { value: "today",     label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "7days",     label: "7 días" },
  { value: "month",     label: "Este mes" },
] as const;

export function PeriodTabs({ current }: { current: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  function navigate(period: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("periodo", period);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="period-tabs" role="group" aria-label="Filtro de período">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          className={`period-tab${current === p.value ? " period-tab--on" : ""}`}
          onClick={() => navigate(p.value)}
          aria-pressed={current === p.value}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
