import type { MetricsStripProps } from "@/types/stock";

export function MetricsStrip({ quote, peRatio, dividendYield }: MetricsStripProps) {
  const prevClose =
    quote?.price && quote?.change
      ? (parseFloat(quote.price) - parseFloat(quote.change)).toFixed(2)
      : "—";

  const turnoverValue =
    quote?.price && quote?.volume
      ? ((parseFloat(quote.price) * quote.volume) / 100000000).toFixed(2) + " 億"
      : "—";

  const metrics = [
    { label: "今開", value: quote?.open ?? "—" },
    { label: "最高", value: quote?.high ?? "—", highlight: true },
    { label: "最低", value: quote?.low ?? "—", highlight: true },
    { label: "昨收", value: prevClose },
    { label: "成交量", value: quote?.volume ? quote.volume.toLocaleString() : "—" },
    { label: "成交值", value: turnoverValue },
    { label: "本益比", value: peRatio ?? "—" },
    { label: "殖利率", value: dividendYield ?? "—", accent: true },
  ];

  return (
    <div className="border-y border-border bg-card animate-fade-in-up delay-100">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-border">
        {metrics.map((m) => (
          <div key={m.label} className="py-3 px-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">
              {m.label}
            </div>
            <div
              className={`text-sm font-semibold ${
                m.accent ? "text-success" : "text-primary"
              }`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
