import type { RiskMetrics } from "@/types";

interface RiskAssessmentProps {
  riskMetrics?: RiskMetrics;
}

export function RiskAssessment({ riskMetrics }: RiskAssessmentProps) {
  const level = riskMetrics?.risk_level || "medium";
  const levelText =
    level === "low" ? "低" : level === "medium" ? "中" : "高";

  const levelColor =
    level === "low"
      ? "text-success"
      : level === "medium"
        ? "text-amber-600"
        : "text-danger";

  const risks = [
    { label: "波動率風險", value: riskMetrics?.volatility_risk ?? 45, level: "中等" },
    { label: "流動性風險", value: riskMetrics?.liquidity_risk ?? 15, level: "低" },
    { label: "匯率風險", value: riskMetrics?.fx_risk ?? 10, level: "低" },
    { label: "系統性風險", value: riskMetrics?.systemic_risk ?? 65, level: "中高" },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-400">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-base">風險評估</h3>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-5 mb-5">
          <div className="relative w-16 h-16 shrink-0">
            <div
              className="w-16 h-16 rounded-full p-1"
              style={{
                background: `conic-gradient(
                  #22c55e 0deg 108deg,
                  #4ade80 108deg 144deg,
                  #f59e0b 144deg 216deg,
                  #ef4444 216deg 288deg,
                  #dc2626 288deg 360deg
                )`,
              }}
            >
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                <span className={`text-sm font-bold ${levelColor}`}>
                  {levelText}
                </span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-primary mb-1">
              綜合風險等級：{levelText === "低" ? "低風險" : levelText === "中" ? "中等風險" : "高風險"}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              基於歷史波動率、流動性及市場相關性綜合評估。請根據自身風險承受能力做出投資決策。
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {risks.map((r) => {
            const barColor =
              r.value < 30
                ? "bg-success"
                : r.value < 60
                  ? "bg-amber-500"
                  : "bg-danger";
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-primary">
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.level}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${r.value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
