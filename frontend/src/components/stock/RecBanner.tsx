import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RecBannerProps } from "@/types/stock";

export function RecBanner({
  recommendation,
  targetPrice,
  potentialReturn,
  stopLoss,
}: RecBannerProps) {
  if (!recommendation) return null;

  const rec = recommendation.recommendation;
  const confidence = recommendation.confidence;

  const bannerBg =
    rec === "buy"
      ? "bg-gradient-to-r from-emerald-600 via-success to-emerald-400"
      : rec === "sell"
        ? "bg-gradient-to-r from-red-600 via-danger to-red-400"
        : "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400";

  const titles: Record<string, string> = {
    buy: "強烈買入 — 短期回調提供絕佳進場點",
    hold: "觀望 — 等待更明確的方向訊號",
    sell: "謹慎 — 考慮減倉或獲利了結",
  };

  const subtitles: Record<string, string> = {
    buy: "基於技術面、資金面及市場情緒綜合分析，當前價位具備高性價比",
    hold: "技術指標呈現多空交錯，建議觀望等待趨勢明朗",
    sell: "多項技術指標轉弱，建議留意風險並適度調整持倉",
  };

  const gaugeCircumference = 2 * Math.PI * 34;
  const gaugeOffset = gaugeCircumference * (1 - confidence / 100);

  return (
    <div className={`${bannerBg} animate-fade-in-up delay-100`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                {rec === "buy" ? (
                  <TrendingUp className="w-8 h-8 text-white" />
                ) : rec === "sell" ? (
                  <TrendingDown className="w-8 h-8 text-white" />
                ) : (
                  <Minus className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <span className="text-white/70 text-sm font-medium">
                  AI 推薦信號
                </span>
                <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                  {rec === "buy" ? "Buy" : rec === "sell" ? "Sell" : "Hold"}
                </span>
              </div>
              <h2 className="text-white font-bold text-xl">{titles[rec]}</h2>
              <p className="text-white/70 text-sm mt-1">{subtitles[rec]}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <div className="text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wider">
                置信度
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="white"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {confidence}%
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden sm:block w-px h-12 bg-white/20" />

            <div className="hidden sm:flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-white/70 text-xs">
                  目標價{" "}
                  <span className="text-white font-semibold">
                    {targetPrice ?? "—"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-white/70 text-xs">
                  潛在報酬{" "}
                  <span className="text-white font-semibold">
                    {potentialReturn ?? "—"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-white/70 text-xs">
                  建議止損{" "}
                  <span className="text-white font-semibold">
                    {stopLoss ?? "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
