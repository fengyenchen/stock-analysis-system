import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStockQuote,
  getStockHistory,
  getStockSyncStatus,
  getStockRecommendation,
  syncStockPrices,
  exportStockHistoryCSV,
  getStock,
  getStockPeers,
  getStockProfile,
  getTargetPrices,
  getStockFundamentals,
} from "@/api/stocks";
import { createAlert } from "@/api/alerts";
import { listWatchlists, addWatchlistItem } from "@/api/watchlists";
import { getApiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useSSEQuotes } from "@/hooks/useSSEQuotes";
import { useTheme } from "@/hooks/useTheme";
import type { StockPrice } from "@/types";
import { toast } from "sonner";

import { StockHeader } from "@/components/stock/StockHeader";
import { RecBanner } from "@/components/stock/RecBanner";
import { MetricsStrip } from "@/components/stock/MetricsStrip";
import { PriceChart } from "@/components/stock/PriceChart";
import { TechnicalIndicators } from "@/components/stock/TechnicalIndicators";
import { AnalysisPoints } from "@/components/stock/AnalysisPoints";
import { QuickActions } from "@/components/stock/QuickActions";
import { BuySellModal } from "@/components/stock/BuySellModal";
import { SignalSummary } from "@/components/stock/SignalSummary";
import { RiskAssessment } from "@/components/stock/RiskAssessment";
import { SupportResistance } from "@/components/stock/SupportResistance";
import { PeerComparison } from "@/components/stock/PeerComparison";
import { FooterDisclaimer } from "@/components/stock/FooterDisclaimer";
import { QuickStatsGrid } from "@/components/stock/QuickStatsGrid";
import { KeyMetricsGrid } from "@/components/stock/KeyMetricsGrid";
import { AnalystConsensus } from "@/components/stock/AnalystConsensus";
import { RelatedStocks } from "@/components/stock/RelatedStocks";
import { FinancialHealthScores } from "@/components/stock/FinancialHealthScores";

import {
  RefreshCw,
  Download,
  Bell,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function aggregatePrices(prices: StockPrice[], resolution: "day" | "week" | "year"): StockPrice[] {
  if (resolution === "day") return prices;
  // Week/Year aggregation omitted for brevity — PriceChart handles raw day data
  return prices;
}

function buildAnalysisPoints(reasons: string[]): {
  text: string;
  detail: string;
  type: "bullish" | "bearish" | "neutral" | "caution";
}[] {
  return reasons.map((r) => {
    const lower = r.toLowerCase();
    const isBullish =
      lower.includes("above") ||
      lower.includes("rose") ||
      lower.includes("healthy") ||
      lower.includes("buy") ||
      lower.includes("positive") ||
      lower.includes("oversold");
    const isBearish =
      lower.includes("below") ||
      lower.includes("fell") ||
      lower.includes("weak") ||
      lower.includes("overbought") ||
      lower.includes("sell");
    const isCaution =
      lower.includes("neutral") || lower.includes("does not") || lower.includes("cautious");
    return {
      text: r,
      detail: r,
      type: isBullish ? "bullish" : isBearish ? "bearish" : isCaution ? "caution" : "neutral",
    };
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}s`;
  return `${seconds}.${tenths}s`;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  const { theme } = useTheme();

  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above");
  const [alertPrice, setAlertPrice] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [buySellModal, setBuySellModal] = useState<{ type: "buy" | "sell" } | null>(null);
  const [, setLastSyncDuration] = useState<number | null>(null);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
  const syncStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  /* -- Data queries -- */
  const { quotes: liveQuotes, connected: sseConnected } = useSSEQuotes(
    symbol ? [symbol] : []
  );
  const liveQuote = symbol ? liveQuotes.get(symbol) : undefined;

  const stockQuery = useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => getStock(symbol!),
    enabled: !!symbol,
  });

  const peersQuery = useQuery({
    queryKey: ["stock-peers", symbol],
    queryFn: () => getStockPeers(symbol!),
    enabled: !!symbol,
  });

  const profileQuery = useQuery({
    queryKey: ["stock-profile", symbol],
    queryFn: () => getStockProfile(symbol!),
    enabled: !!symbol,
  });

  const quoteQuery = useQuery({
    queryKey: ["stock-quote", symbol],
    queryFn: () => getStockQuote(symbol!),
    enabled: !!symbol && !liveQuote,
    refetchInterval: liveQuote ? false : 30000,
  });

  const historyQuery = useQuery({
    queryKey: ["stock-history", symbol],
    queryFn: () => getStockHistory(symbol!),
    enabled: !!symbol,
  });

  const syncStatusQuery = useQuery({
    queryKey: ["stock-sync-status", symbol],
    queryFn: () => getStockSyncStatus(symbol!),
    enabled: !!symbol,
  });

  const watchlistsQuery = useQuery({
    queryKey: ["watchlists"],
    queryFn: listWatchlists,
    enabled: isAuthenticated,
  });

  const recommendationQuery = useQuery({
    queryKey: ["stock-recommendation", symbol],
    queryFn: () => getStockRecommendation(symbol!),
    enabled: !!symbol,
  });

  const targetPricesQuery = useQuery({
    queryKey: ["target-prices", symbol],
    queryFn: () => getTargetPrices(symbol!),
    enabled: !!symbol,
  });

  const fundamentalsQuery = useQuery({
    queryKey: ["stock-fundamentals", symbol],
    queryFn: () => getStockFundamentals(symbol!),
    enabled: !!symbol,
    staleTime: 300000,
  });

  /* -- Mutations -- */
  const syncMutation = useMutation({
    mutationFn: () => {
      syncStartRef.current = Date.now();
      return syncStockPrices(symbol!);
    },
    onSuccess: (data) => {
      if (syncStartRef.current) setLastSyncDuration(Date.now() - syncStartRef.current);
      if (data.status === "failed") toast.error(data.error || "Sync failed");
      else toast.success(data.message || "Sync completed");
      queryClient.invalidateQueries({ queryKey: ["stock-history", symbol] });
      queryClient.invalidateQueries({ queryKey: ["stock-sync-status", symbol] });
    },
    onError: (err: unknown) => {
      if (syncStartRef.current) setLastSyncDuration(Date.now() - syncStartRef.current);
      toast.error(getApiErrorMessage(err, "Sync failed"));
    },
  });

  const alertMutation = useMutation({
    mutationFn: () =>
      createAlert({
        symbol: symbol!,
        condition: alertCondition,
        target_price: alertPrice,
      }),
    onSuccess: () => {
      toast.success("Price alert created");
      setShowAlertForm(false);
      setAlertPrice("");
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Failed to create alert"));
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ watchlistId, symbol: s }: { watchlistId: number; symbol: string }) =>
      addWatchlistItem(watchlistId, s),
    onSuccess: () => {
      toast.success("Added to watchlist");
      setShowAddMenu(false);
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Failed to add to watchlist"));
    },
  });

  /* -- Effects -- */
  useEffect(() => {
    if (!syncMutation.isPending) {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [syncMutation.isPending]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !autoSyncAttempted &&
      historyQuery.data &&
      historyQuery.data.length === 0 &&
      !historyQuery.isLoading &&
      !syncMutation.isPending &&
      !syncMutation.isSuccess
    ) {
      setAutoSyncAttempted(true);
      syncMutation.mutate();
    }
  }, [isAuthenticated, historyQuery.data, historyQuery.isLoading, autoSyncAttempted, syncMutation]);

  /* -- Derived data -- */
  const quote = liveQuote || quoteQuery.data;
  const isUp = quote?.change ? parseFloat(quote.change) >= 0 : true;
  const syncStatus = syncStatusQuery.data;
  const isDark = theme === "dark";

  const chartData = useMemo(() => {
    if (!historyQuery.data) return [];
    return aggregatePrices(historyQuery.data, "day");
  }, [historyQuery.data]);

  const analysisPoints = useMemo(() => {
    if (!recommendationQuery.data?.reasons) return [];
    return buildAnalysisPoints(recommendationQuery.data.reasons);
  }, [recommendationQuery.data]);

  const volumeAnalysis = useMemo(() => {
    const rec = recommendationQuery.data;
    if (!rec) return undefined;
    return {
      volume: quote?.volume,
      avgVolume20d: rec.indicators.avg_volume_20d ?? undefined,
      volumeRatio: rec.indicators.volume_ratio ?? undefined,
    };
  }, [recommendationQuery.data, quote]);

  const profile = profileQuery.data;

  const peerStocks = useMemo(() => {
    const peers = peersQuery.data || [];
    return peers.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: "—",
      changePercent: "0",
      recommendation: "hold" as "buy" | "hold" | "sell",
    }));
  }, [peersQuery.data]);

  /* -- Handlers -- */
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${symbol} Stock Detail`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportStockHistoryCSV(symbol!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol}_prices.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const rec = recommendationQuery.data;

  /* -- Render -- */
  return (
    <div className="space-y-0">
      {/* Recommendation Banner */}
      {rec && (
        <RecBanner
          recommendation={rec}
          targetPrice={rec.support_resistance?.target_price ?? undefined}
          potentialReturn={rec.support_resistance?.potential_return ?? undefined}
          stopLoss={rec.support_resistance?.stop_loss ?? undefined}
        />
      )}

      {/* Metrics Strip */}
      <MetricsStrip
        quote={quote}
        peRatio={profile?.pe_ratio ?? undefined}
        dividendYield={profile?.dividend_yield ? (parseFloat(profile.dividend_yield) * 100).toFixed(2) + "%" : undefined}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stock Header */}
            <StockHeader
              symbol={symbol || ""}
              stock={stockQuery.data}
              quote={quote}
              recommendation={rec || undefined}
              isUp={isUp}
              onShare={handleShare}
            />

            {/* Alert Form */}
            {showAlertForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent" />
                    Create Price Alert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={alertCondition}
                      onChange={(e) => setAlertCondition(e.target.value as "above" | "below")}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                    >
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                    <Input
                      type="number"
                      placeholder="Target price"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      className="w-40"
                    />
                    <Button
                      onClick={() => alertMutation.mutate()}
                      disabled={!alertPrice || alertMutation.isPending}
                    >
                      Create
                    </Button>
                    <Button variant="ghost" onClick={() => setShowAlertForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Chart */}
            <PriceChart data={chartData} isLoading={historyQuery.isLoading} isDark={isDark} />

            {/* Technical Indicators */}
            <TechnicalIndicators
              recommendation={rec || undefined}
              volumeAnalysis={volumeAnalysis}
            />

            {/* Analysis Points */}
            <AnalysisPoints
              points={analysisPoints}
              updatedAt={
                rec?.as_of
                  ? new Date(rec.as_of).toLocaleDateString("zh-TW") + " 15:30"
                  : undefined
              }
            />

            {/* Quick Stats Grid */}
            <QuickStatsGrid
              fundamentals={fundamentalsQuery.data || null}
              currentPrice={quote?.price}
            />

            {/* Key Metrics Grid */}
            <KeyMetricsGrid fundamentals={fundamentalsQuery.data || null} />

            {/* Analyst Consensus */}
            <AnalystConsensus
              targetPrices={targetPricesQuery.data || []}
              currentPrice={quote?.price}
            />

            {/* Related Stocks */}
            <RelatedStocks symbol={symbol || ""} />

            {/* Financial Health Scores */}
            <FinancialHealthScores
              fundamentals={fundamentalsQuery.data || null}
              recommendation={rec || null}
              currentPrice={quote?.price}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActions
              onBuy={() => setBuySellModal({ type: "buy" })}
              onSell={() => setBuySellModal({ type: "sell" })}
              onAlert={() => setShowAlertForm(!showAlertForm)}
              onWatchlist={() => setShowAddMenu(!showAddMenu)}
            />

            {/* Buy/Sell Modal */}
            {buySellModal && (
              <BuySellModal
                symbol={symbol || ""}
                type={buySellModal.type}
                currentPrice={quote?.price}
                onClose={() => setBuySellModal(null)}
              />
            )}

            {/* Watchlist dropdown */}
            {showAddMenu && isAuthenticated && (
              <Card>
                <CardContent className="p-3">
                  {watchlistsQuery.data?.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No watchlists.{" "}
                      <Link to="/watchlists" className="text-accent underline">
                        Create one
                      </Link>
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {watchlistsQuery.data?.map((wl) => (
                        <button
                          key={wl.id}
                          onClick={() =>
                            addItemMutation.mutate({ watchlistId: wl.id, symbol: symbol! })
                          }
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                        >
                          {wl.name}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Signal Summary */}
            <SignalSummary recommendation={rec || undefined} />

            {/* Risk Assessment */}
            <RiskAssessment riskMetrics={rec?.risk_metrics} />

            {/* Support / Resistance */}
            <SupportResistance
              levels={rec?.support_resistance}
              currentPrice={quote?.price}
            />

            {/* Peer Comparison */}
            <PeerComparison peers={peerStocks} currentSymbol={symbol || ""} />

            {/* Sync + CSV Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data</span>
                  {sseConnected && (
                    <Badge variant="success" className="flex items-center gap-1 text-xs">
                      <Radio className="w-3 h-3 animate-pulse" />
                      Live
                    </Badge>
                  )}
                </div>
                {syncStatus && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Status:{" "}
                      <span className="font-medium text-primary">{syncStatus.status}</span>
                    </p>
                    <p>
                      Synced: {syncStatus.synced_from || "—"} to {syncStatus.synced_to || "—"}
                    </p>
                  </div>
                )}
                {isAuthenticated && (
                  <Button
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    {syncMutation.isPending ? `Syncing… ${formatDuration(elapsedMs)}` : "Sync Market Data"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleExportCSV} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <FooterDisclaimer />
    </div>
  );
}
