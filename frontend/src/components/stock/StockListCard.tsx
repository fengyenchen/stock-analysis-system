import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MiniSparkline } from "./MiniSparkline";
import type { Stock } from "@/types";

interface StockListCardProps {
  stock: Stock;
  price?: string | null;
  changePercent?: string | null;
  recommendation?: "buy" | "hold" | "sell" | null;
  sparklineData?: number[];
  isEtf?: boolean;
}

const recVariantMap: Record<string, "success" | "warning" | "danger"> = {
  buy: "success",
  hold: "warning",
  sell: "danger",
};

const recTextMap: Record<string, string> = {
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
};

export const StockListCard = memo(function StockListCard({
  stock,
  price,
  changePercent,
  recommendation,
  sparklineData,
  isEtf,
}: StockListCardProps) {
  const changeNum = changePercent ? parseFloat(changePercent) : 0;
  const isUp = changeNum >= 0;

  return (
    <Link
      to={`/stocks/${stock.symbol}`}
      className="group bg-card border border-border rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-lg font-bold text-primary truncate">
            {stock.symbol}
          </span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {stock.market}
          </Badge>
          {isEtf && (
            <Badge
              variant="secondary"
              className="text-xs bg-blue-50 text-blue-600 shrink-0"
            >
              ETF
            </Badge>
          )}
          {recommendation && (
            <Badge
              variant={recVariantMap[recommendation]}
              className="text-xs shrink-0"
            >
              {recTextMap[recommendation]}
            </Badge>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="min-w-0 mb-3">
        <p className="text-sm text-muted-foreground truncate">{stock.name}</p>
        {stock.industry && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {stock.industry}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0">
          {price ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-primary">
                {price}
              </span>
              {changePercent !== undefined && changePercent !== null && (
                <span
                  className={`text-xs font-medium ${
                    isUp ? "text-danger" : "text-success"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {changeNum.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <MiniSparkline data={sparklineData} />
        )}
      </div>
    </Link>
  );
});
