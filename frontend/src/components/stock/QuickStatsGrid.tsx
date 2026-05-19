import type { StockFundamental } from "@/types";

interface QuickStatsGridProps {
  fundamentals?: StockFundamental | null;
  currentPrice?: string;
}

export function QuickStatsGrid({ fundamentals, currentPrice }: QuickStatsGridProps) {
  const pe = fundamentals?.pe_ratio ? parseFloat(fundamentals.pe_ratio) : null;
  const yieldPct = fundamentals?.dividend_yield
    ? (parseFloat(fundamentals.dividend_yield) * 100).toFixed(2)
    : null;
  const marketCap = fundamentals?.market_cap
    ? (parseFloat(fundamentals.market_cap) / 1e12).toFixed(2) + "T"
    : null;

  const high52 = fundamentals?.fifty_two_week_high
    ? parseFloat(fundamentals.fifty_two_week_high)
    : null;
  const low52 = fundamentals?.fifty_two_week_low
    ? parseFloat(fundamentals.fifty_two_week_low)
    : null;
  const price = currentPrice ? parseFloat(currentPrice) : null;

  const rangePercent =
    high52 && low52 && price
      ? ((price - low52) / (high52 - low52)) * 100
      : null;

  return (
    <div className="grid grid-cols-2 gap-4 animate-fade-in-up delay-200">
      {/* Market Cap */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
        <p className="text-xs text-muted-foreground mb-1">市值</p>
        <p className="text-2xl font-bold">{marketCap ?? "—"}</p>
      </div>

      {/* P/E Ratio */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
        <p className="text-xs text-muted-foreground mb-1">本益比</p>
        <p className="text-2xl font-bold">{fundamentals?.pe_ratio ?? "—"}</p>
        {pe !== null && (
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${Math.min(100, (pe / 50) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Dividend Yield */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
        <p className="text-xs text-muted-foreground mb-1">殖利率</p>
        <p className="text-2xl font-bold text-success">
          {yieldPct ? `${yieldPct}%` : "—"}
        </p>
      </div>

      {/* 52-Week Range */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
        <p className="text-xs text-muted-foreground mb-1">52週區間</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{low52 ?? "—"}</span>
          <span>{high52 ?? "—"}</span>
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-success to-danger rounded-full opacity-20" />
          {rangePercent !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent border-2 border-white rounded-full shadow"
              style={{ left: `calc(${rangePercent}% - 6px)` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
