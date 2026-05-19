import { useEffect, useRef, useState } from "react";
import type { StockFundamental, StockRecommendation } from "@/types";

interface FinancialHealthScoresProps {
  fundamentals?: StockFundamental | null;
  recommendation?: StockRecommendation | null;
  currentPrice?: string;
}

function AnimatedBar({ value, max = 100, colorClass = "bg-accent" }: { value: number; max?: number; colorClass?: string }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWidth(Math.min(100, Math.max(0, (value / max) * 100)));
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, max]);

  return (
    <div ref={ref} className="h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClass} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function FinancialHealthScores({ fundamentals, recommendation, currentPrice }: FinancialHealthScoresProps) {
  if (!fundamentals) return null;

  const pe = fundamentals.pe_ratio ? parseFloat(fundamentals.pe_ratio) : null;
  const forwardPe = fundamentals.forward_pe ? parseFloat(fundamentals.forward_pe) : null;
  const revenueGrowth = fundamentals.revenue_growth ? parseFloat(fundamentals.revenue_growth) : null;
  const profitMargins = fundamentals.profit_margins ? parseFloat(fundamentals.profit_margins) : null;
  const roe = fundamentals.return_on_equity ? parseFloat(fundamentals.return_on_equity) : null;
  const high52 = fundamentals.fifty_two_week_high ? parseFloat(fundamentals.fifty_two_week_high) : null;
  const low52 = fundamentals.fifty_two_week_low ? parseFloat(fundamentals.fifty_two_week_low) : null;
  const price = currentPrice ? parseFloat(currentPrice) : null;

  const rangeScore = high52 && low52 && price ? ((price - low52) / (high52 - low52)) * 100 : null;
  const rsi = recommendation?.indicators.rsi14 ? parseFloat(recommendation.indicators.rsi14) : null;
  const momentumScore = rsi ? Math.max(0, 100 - Math.abs(rsi - 50) * 2) : null;

  const categories = [
    {
      title: "成長性",
      color: "bg-blue-500",
      metrics: [
        { label: "營收成長率", value: revenueGrowth, display: revenueGrowth !== null ? `${(revenueGrowth * 100).toFixed(1)}%` : "—", score: revenueGrowth !== null ? Math.min(100, Math.max(0, (revenueGrowth + 0.5) * 100)) : 0 },
        { label: "EPS", value: fundamentals.eps ? parseFloat(fundamentals.eps) : null, display: fundamentals.eps ?? "—", score: fundamentals.eps ? Math.min(100, Math.max(0, parseFloat(fundamentals.eps) * 20 + 50)) : 0 },
      ],
    },
    {
      title: "獲利能力",
      color: "bg-emerald-500",
      metrics: [
        { label: "利潤率", value: profitMargins, display: profitMargins !== null ? `${(profitMargins * 100).toFixed(1)}%` : "—", score: profitMargins !== null ? Math.min(100, profitMargins * 200) : 0 },
        { label: "ROE", value: roe, display: roe !== null ? `${(roe * 100).toFixed(1)}%` : "—", score: roe !== null ? Math.min(100, roe * 100) : 0 },
      ],
    },
    {
      title: "動能",
      color: "bg-purple-500",
      metrics: [
        { label: "52週位置", value: rangeScore, display: rangeScore !== null ? `${rangeScore.toFixed(1)}%` : "—", score: rangeScore ?? 0 },
        { label: "RSI動能", value: momentumScore, display: momentumScore !== null ? `${momentumScore.toFixed(0)}` : "—", score: momentumScore ?? 0 },
      ],
    },
    {
      title: "估值",
      color: "bg-amber-500",
      metrics: [
        { label: "本益比", value: pe, display: fundamentals.pe_ratio ?? "—", score: pe !== null ? Math.max(0, Math.min(100, (50 - pe) * 2 + 50)) : 0 },
        { label: "Forward P/E", value: forwardPe, display: fundamentals.forward_pe ?? "—", score: forwardPe !== null ? Math.max(0, Math.min(100, (50 - forwardPe) * 2 + 50)) : 0 },
      ],
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-400">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-lg">財務健康度</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {categories.map((cat) => (
            <div key={cat.title} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                <h4 className="font-semibold text-sm">{cat.title}</h4>
              </div>
              {cat.metrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span className="text-xs font-semibold">{m.display}</span>
                  </div>
                  <AnimatedBar value={m.score} colorClass={cat.color} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
