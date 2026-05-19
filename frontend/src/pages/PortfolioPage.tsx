
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPortfolioPositions } from "@/api/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export function PortfolioPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-positions"],
    queryFn: getPortfolioPositions,
  });

  const totalMarketValue = data?.reduce(
    (sum, p) => sum + (p.market_value ? parseFloat(p.market_value) : 0),
    0
  ) ?? 0;

  const totalUnrealized = data?.reduce(
    (sum, p) => sum + (p.unrealized_pnl ? parseFloat(p.unrealized_pnl) : 0),
    0
  ) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">投資組合</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">總市值</p>
            <p className="text-xl font-bold">{totalMarketValue.toLocaleString()} TWD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">未實現損益</p>
            <p className={`text-xl font-bold ${totalUnrealized >= 0 ? "text-danger" : "text-success"}`}>
              {totalUnrealized >= 0 ? "+" : ""}
              {totalUnrealized.toLocaleString()} TWD
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">持倉數</p>
            <p className="text-xl font-bold">{data?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>持倉明細</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>尚無持倉</p>
              <p className="text-sm mt-1">前往股票詳情頁面進行買入操作</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">股票</th>
                    <th className="text-right py-3 px-2">股數</th>
                    <th className="text-right py-3 px-2">均價</th>
                    <th className="text-right py-3 px-2">現價</th>
                    <th className="text-right py-3 px-2">市值</th>
                    <th className="text-right py-3 px-2">損益</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((pos) => {
                    const pnl = parseFloat(pos.unrealized_pnl || "0");
                    const isProfit = pnl >= 0;
                    return (
                      <tr
                        key={pos.symbol}
                        className="border-b border-border/50 hover:bg-muted transition-colors"
                      >
                        <td className="py-3 px-2">
                          <Link
                            to={`/stocks/${pos.symbol}`}
                            className="font-semibold hover:text-accent"
                          >
                            {pos.symbol}
                          </Link>
                          <div className="text-xs text-muted-foreground">{pos.name}</div>
                        </td>
                        <td className="text-right py-3 px-2">{parseFloat(pos.shares).toLocaleString()}</td>
                        <td className="text-right py-3 px-2">{pos.avg_price}</td>
                        <td className="text-right py-3 px-2">{pos.current_price ?? "—"}</td>
                        <td className="text-right py-3 px-2">{pos.market_value ?? "—"}</td>
                        <td className="text-right py-3 px-2">
                          <span className={`flex items-center justify-end gap-1 ${isProfit ? "text-danger" : "text-success"}`}>
                            {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isProfit ? "+" : ""}{pnl.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
