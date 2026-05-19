import type { StockFundamental } from "@/types";

interface KeyMetricsGridProps {
  fundamentals?: StockFundamental | null;
}

export function KeyMetricsGrid({ fundamentals }: KeyMetricsGridProps) {
  const metrics = [
    {
      label: "EPS",
      value: fundamentals?.eps ?? "—",
      positive: fundamentals?.eps ? parseFloat(fundamentals.eps) > 0 : false,
    },
    {
      label: "營收成長率",
      value: fundamentals?.revenue_growth
        ? (parseFloat(fundamentals.revenue_growth) * 100).toFixed(1) + "%"
        : "—",
      positive: fundamentals?.revenue_growth
        ? parseFloat(fundamentals.revenue_growth) > 0
        : false,
    },
    {
      label: "利潤率",
      value: fundamentals?.profit_margins
        ? (parseFloat(fundamentals.profit_margins) * 100).toFixed(1) + "%"
        : "—",
      positive: fundamentals?.profit_margins
        ? parseFloat(fundamentals.profit_margins) > 0
        : false,
    },
    {
      label: "負債權益比",
      value: fundamentals?.debt_to_equity ?? "—",
      positive: fundamentals?.debt_to_equity
        ? parseFloat(fundamentals.debt_to_equity) < 100
        : false,
    },
    {
      label: "ROE",
      value: fundamentals?.return_on_equity
        ? (parseFloat(fundamentals.return_on_equity) * 100).toFixed(1) + "%"
        : "—",
      positive: fundamentals?.return_on_equity
        ? parseFloat(fundamentals.return_on_equity) > 0.1
        : false,
    },
    {
      label: "自由現金流",
      value: fundamentals?.free_cashflow
        ? (parseFloat(fundamentals.free_cashflow) / 1e9).toFixed(2) + "B"
        : "—",
      positive: fundamentals?.free_cashflow
        ? parseFloat(fundamentals.free_cashflow) > 0
        : false,
    },
    {
      label: "Beta",
      value: fundamentals?.beta ?? "—",
      positive: fundamentals?.beta
        ? parseFloat(fundamentals.beta) < 1.5
        : false,
    },
    {
      label: "Forward P/E",
      value: fundamentals?.forward_pe ?? "—",
      positive: fundamentals?.forward_pe
        ? parseFloat(fundamentals.forward_pe) < 25
        : false,
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-300">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-lg">關鍵指標</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="p-4 rounded-xl bg-muted border border-border hover:-translate-y-0.5 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    m.positive ? "bg-success" : "bg-amber-500"
                  }`}
                />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-lg font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
