import type { RSIGaugeProps } from "@/types/stock";

export function RSIGauge({ value }: RSIGaugeProps) {
  const num = value ? parseFloat(value) : 50;
  const clamped = Math.max(0, Math.min(100, num));

  const getLabel = (v: number) => {
    if (v > 70) return "超買";
    if (v < 30) return "超賣";
    if (v >= 45 && v <= 55) return "中性";
    if (v > 55) return "中性偏多";
    return "中性偏空";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-primary">RSI (14)</span>
        <span
          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
            num > 70
              ? "bg-red-50 text-danger"
              : num < 30
                ? "bg-green-50 text-success"
                : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {value ?? "—"} — {getLabel(num)}
        </span>
      </div>

      <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
        <div className="absolute inset-y-0 left-0 w-[30%] bg-danger/20" />
        <div className="absolute inset-y-0 left-[30%] w-[40%] bg-success/15" />
        <div className="absolute inset-y-0 left-[70%] w-[30%] bg-danger/20" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-success border-2 border-white rounded-full shadow-md transition-all duration-500"
          style={{ left: `calc(${clamped}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mb-3">
        <span>超賣 0</span>
        <span>30</span>
        <span>50</span>
        <span>70</span>
        <span>超買 100</span>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          RSI {getLabel(num)}
          {num > 70
            ? "，短期過熱需留意回調風險。"
            : num < 30
              ? "，具備反彈潛力，可關注買入機會。"
              : "，動能平穩，適合觀察趨勢延續性。"}
        </p>
      </div>
    </div>
  );
}
