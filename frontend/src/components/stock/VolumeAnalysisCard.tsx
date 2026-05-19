import { Info } from "lucide-react";
import type { VolumeAnalysisProps } from "@/types/stock";

export function VolumeAnalysisCard({
  volume,
  avgVolume20d,
  volumeRatio,
}: VolumeAnalysisProps) {
  const ratio = volumeRatio ? parseFloat(volumeRatio) : 1;
  const status =
    ratio >= 1.5
      ? "放量"
      : ratio >= 1.1
        ? "活躍"
        : ratio >= 0.8
          ? "量縮健康"
          : "量縮";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-primary">量能分析</span>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full">
          {status}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">今日成交量</span>
          <span className="text-sm font-semibold">
            {volume ? volume.toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">5日均量</span>
          <span className="text-sm font-semibold">
            {avgVolume20d ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">量比</span>
          <span className="text-sm font-semibold">{volumeRatio ?? "—"}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          {ratio >= 1.1
            ? "成交量高於均量，顯示市場關注度提升，價格變動具備量能支撐。"
            : ratio >= 0.8
              ? "回調時伴隨量能萎縮，屬於健康的整理行為。若後續放量反彈，將確認多頭續航。"
              : "成交量明顯低於均量，市場觀望情緒濃厚，需等待放量確認方向。"}
        </p>
      </div>
    </div>
  );
}
