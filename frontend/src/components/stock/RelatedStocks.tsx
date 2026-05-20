import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getStockPeers } from "@/api/stocks";
import { getStockQuote } from "@/api/stocks";
import { getStockHistory } from "@/api/stocks";
import { MiniSparkline } from "./MiniSparkline";
import type { Stock } from "@/types";

interface PeerCardProps {
  stock: Stock;
}

function PeerCard({ stock }: PeerCardProps) {
  const quoteQuery = useQuery({
    queryKey: ["peer-quote", stock.symbol],
    queryFn: () => getStockQuote(stock.symbol),
    enabled: !!stock.symbol,
    staleTime: 60000,
  });

  const historyQuery = useQuery({
    queryKey: ["peer-history", stock.symbol],
    queryFn: () => getStockHistory(stock.symbol),
    enabled: !!stock.symbol,
    staleTime: 300000,
  });

  const quote = quoteQuery.data;
  const prices = historyQuery.data?.slice(-20).map((p) => parseFloat(p.close_price)) || [];
  const changePct = quote?.change_percent ? parseFloat(quote.change_percent) : 0;
  const isUp = changePct >= 0;

  return (
    <Link
      to={`/stocks/${stock.symbol}`}
      className="flex-shrink-0 w-40 bg-card rounded-xl border border-border p-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all"
    >
      <div className="text-sm font-bold mb-0.5">{stock.symbol}</div>
      <div className="text-xs text-muted-foreground truncate mb-2">{stock.name}</div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold">{quote?.price ?? "—"}</span>
        <span className={`text-xs ${isUp ? "text-danger" : "text-success"}`}>
          {isUp ? "+" : ""}{changePct.toFixed(2)}%
        </span>
      </div>
      <MiniSparkline data={prices} />
    </Link>
  );
}

interface RelatedStocksProps {
  symbol: string;
}

export function RelatedStocks({ symbol }: RelatedStocksProps) {
  const { data: peers } = useQuery({
    queryKey: ["stock-peers", symbol],
    queryFn: () => getStockPeers(symbol),
    enabled: !!symbol,
  });

  if (!peers || peers.length === 0) return null;

  return (
    <div className="animate-fade-in-up delay-400">
      <h3 className="font-bold text-lg mb-4">相關股票</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {peers.slice(0, 6).map((stock) => (
          <PeerCard key={stock.symbol} stock={stock} />
        ))}
      </div>
    </div>
  );
}
