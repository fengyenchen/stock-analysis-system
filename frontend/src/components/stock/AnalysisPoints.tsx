import { Check, AlertTriangle } from "lucide-react";
import type { AnalysisPointsProps } from "@/types/stock";

export function AnalysisPoints({ points, updatedAt }: AnalysisPointsProps) {
  if (!points || points.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-400">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-lg">AI 分析要點</h3>
        <span className="text-xs text-muted-foreground">
          更新於 {updatedAt ?? "—"}
        </span>
      </div>
      <div className="p-6 space-y-4">
        {points.map((point, i) => {
          const isCaution = point.type === "caution" || point.type === "bearish";
          return (
            <div key={i} className="flex gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isCaution
                    ? "bg-amber-100"
                    : "bg-emerald-100"
                }`}
              >
                {isCaution ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-primary">{point.text}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {point.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
