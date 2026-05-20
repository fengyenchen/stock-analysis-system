import type { SupportResistanceLevels } from "@/types";

interface SupportResistanceProps {
  levels?: SupportResistanceLevels;
  currentPrice?: string;
}

export function SupportResistance({
  levels,
  currentPrice,
}: SupportResistanceProps) {
  if (!levels) return null;

  const allLevels = [
    { label: "壓力二", value: levels.r2, percent: "+12.1%", color: "text-primary" },
    { label: "壓力一", value: levels.r1, percent: "+7.1%", color: "text-primary" },
    {
      label: "當前價位",
      value: currentPrice,
      percent: "NOW",
      color: "text-success",
      isCurrent: true,
    },
    { label: "支撐一", value: levels.s1, percent: "-0.7%", color: "text-primary" },
    { label: "支撐二", value: levels.s2, percent: "-5.0%", color: "text-primary" },
    {
      label: "建議止損",
      value: levels.stop_loss,
      percent: "-7.2%",
      color: "text-danger",
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-500">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-base">關鍵價位</h3>
      </div>
      <div className="p-6">
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-0">
            {allLevels.map((level, i) => (
              <div
                key={level.label}
                className={`relative pl-6 ${i < allLevels.length - 1 ? "pb-5" : ""}`}
              >
                <div
                  className={`absolute left-0 ${
                    level.isCurrent
                      ? "w-4 h-4 -translate-x-[7px] rounded-full border-2 border-success bg-card"
                      : "w-3 h-px"
                  } ${level.label === "壓力一" || level.label === "壓力二" ? "bg-danger/50" : level.label === "建議止損" ? "bg-danger" : "bg-success/50"}`}
                  style={
                    level.isCurrent
                      ? { top: "2px" }
                      : { top: "10px" }
                  }
                />
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={`text-xs ${
                        level.isCurrent
                          ? "text-success font-medium"
                          : level.label === "建議止損"
                            ? "text-danger font-medium"
                            : "text-muted-foreground"
                      }`}
                    >
                      {level.label}
                    </div>
                    <div className={`text-sm font-bold ${level.color}`}>
                      {level.value ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`text-xs ${
                      level.isCurrent
                        ? "px-2 py-0.5 bg-emerald-50 text-success font-bold rounded"
                        : level.label === "建議止損"
                          ? "text-danger"
                          : "text-muted-foreground"
                    }`}
                  >
                    {level.percent}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
