import type { StockTargetPrice } from "@/types";

interface AnalystConsensusProps {
  targetPrices: StockTargetPrice[];
  currentPrice?: string;
}

export function AnalystConsensus({ targetPrices, currentPrice }: AnalystConsensusProps) {
  if (!targetPrices || targetPrices.length === 0) return null;

  const counts = { buy: 0, hold: 0, sell: 0 };
  let totalTarget = 0;

  for (const tp of targetPrices) {
    const r = tp.rating.toLowerCase();
    if (r === "buy" || r === "strong_buy") counts.buy++;
    else if (r === "sell" || r === "strong_sell") counts.sell++;
    else counts.hold++;
    totalTarget += parseFloat(tp.target_price);
  }

  const total = counts.buy + counts.hold + counts.sell;
  const avgTarget = totalTarget / targetPrices.length;
  const current = currentPrice ? parseFloat(currentPrice) : null;
  const upside = current ? ((avgTarget - current) / current) * 100 : null;

  const buyPct = (counts.buy / total) * 100;
  const holdPct = (counts.hold / total) * 100;
  const sellPct = (counts.sell / total) * 100;

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const buyOffset = circumference * (1 - buyPct / 100);
  const holdOffset = circumference * (1 - holdPct / 100);
  const sellOffset = circumference * (1 - sellPct / 100);

  const dominant =
    counts.buy >= counts.hold && counts.buy >= counts.sell
      ? "買入"
      : counts.sell >= counts.buy && counts.sell >= counts.hold
        ? "賣出"
        : "持有";

  const dominantColor =
    dominant === "買入" ? "#22c55e" : dominant === "賣出" ? "#ef4444" : "#f59e0b";

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-300">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-lg">分析師共識</h3>
      </div>
      <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-40 h-40 shrink-0">
          <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
            {/* Background */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            {/* Buy segment */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={buyOffset}
              strokeLinecap="round"
            />
            {/* Hold segment */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={holdOffset}
              strokeLinecap="round"
              style={{
                transform: `rotate(${(buyPct / 100) * 360}deg)`,
                transformOrigin: "center",
              }}
            />
            {/* Sell segment */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={sellOffset}
              strokeLinecap="round"
              style={{
                transform: `rotate(${((buyPct + holdPct) / 100) * 360}deg)`,
                transformOrigin: "center",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">共識</span>
            <span className="text-xl font-bold" style={{ color: dominantColor }}>
              {dominant}
            </span>
          </div>
        </div>

        {/* Legend + Stats */}
        <div className="flex-1 space-y-3 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm">買入</span>
            </div>
            <span className="text-sm font-semibold">{counts.buy} ({buyPct.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm">持有</span>
            </div>
            <span className="text-sm font-semibold">{counts.hold} ({holdPct.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-danger" />
              <span className="text-sm">賣出</span>
            </div>
            <span className="text-sm font-semibold">{counts.sell} ({sellPct.toFixed(0)}%)</span>
          </div>

          <div className="pt-3 border-t border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">平均目標價</span>
              <span className="font-semibold">{avgTarget.toFixed(2)}</span>
            </div>
            {upside !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">上漲空間</span>
                <span className={`font-semibold ${upside >= 0 ? "text-success" : "text-danger"}`}>
                  {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
