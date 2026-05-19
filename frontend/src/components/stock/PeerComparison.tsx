import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import type { PeerComparisonProps } from "@/types/stock";

export function PeerComparison({ peers, currentSymbol }: PeerComparisonProps) {
  if (!peers || peers.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-500">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-bold text-base">同類比較</h3>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                代碼
              </th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">
                價格
              </th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">
                漲跌
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
                信號
              </th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer) => {
              const isCurrent = peer.symbol === currentSymbol;
              const isUp = peer.changePercent && !peer.changePercent.startsWith("-");
              return (
                <tr
                  key={peer.symbol}
                  className={`border-b border-border/50 hover:bg-muted transition-colors cursor-pointer ${
                    isCurrent ? "bg-emerald-50/50" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <Link
                      to={`/stocks/${peer.symbol}`}
                      className={`font-semibold ${
                        isCurrent ? "text-primary" : "text-primary"
                      }`}
                    >
                      {peer.symbol}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {peer.name}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">{peer.price}</td>
                  <td
                    className={`py-3 px-3 text-right font-medium ${
                      isUp ? "text-danger" : "text-success"
                    }`}
                  >
                    {peer.changePercent}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge
                      variant={
                        peer.recommendation === "buy"
                          ? "success"
                          : peer.recommendation === "sell"
                            ? "danger"
                            : "warning"
                      }
                      className="text-xs"
                    >
                      {peer.recommendation === "buy"
                        ? "BUY"
                        : peer.recommendation === "sell"
                          ? "SELL"
                          : "HOLD"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
