import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { getStockQuote, getStockHistory, getStockSyncStatus, getStockRecommendation, syncStockPrices } from "@/api/stocks";
import { listWatchlists, addWatchlistItem } from "@/api/watchlists";
import { getApiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import type { StockPrice } from "@/types";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Timer,
  Brain,
} from "lucide-react";

type Resolution = "day" | "week" | "year";

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return monday.toISOString().split("T")[0];
}

function aggregatePrices(prices: StockPrice[], resolution: Resolution): StockPrice[] {
  if (resolution === "day") return prices;

  const groups = new Map<string, StockPrice[]>();

  for (const p of prices) {
    let key: string;
    if (resolution === "week") {
      key = getMonday(p.date);
    } else {
      key = p.date.substring(0, 4) + "-01-01";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  const result: StockPrice[] = [];

  for (const key of sortedKeys) {
    const group = groups.get(key)!;
    group.sort((a, b) => a.date.localeCompare(b.date));

    const open = group[0].open_price;
    const close = group[group.length - 1].close_price;
    const high = Math.max(...group.map((p) => parseFloat(p.high_price)))
      .toFixed(2);
    const low = Math.min(...group.map((p) => parseFloat(p.low_price)))
      .toFixed(2);
    const volume = group.reduce((sum, p) => sum + p.volume, 0);

    result.push({
      date: key,
      open_price: open,
      high_price: high,
      low_price: low,
      close_price: close,
      volume,
    });
  }

  return result;
}

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const syncStartRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("day");

  const quoteQuery = useQuery({
    queryKey: ["stock-quote", symbol],
    queryFn: () => getStockQuote(symbol!),
    enabled: !!symbol,
    refetchInterval: 30000,
  });

  const historyQuery = useQuery({
    queryKey: ["stock-history", symbol, startDate, endDate],
    queryFn: () => getStockHistory(symbol!, startDate || undefined, endDate || undefined),
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

  const [lastSyncDuration, setLastSyncDuration] = useState<number | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => {
      syncStartRef.current = Date.now();
      return syncStockPrices(symbol!, startDate || undefined, endDate || undefined);
    },
    onSuccess: (data) => {
      if (syncStartRef.current) {
        setLastSyncDuration(Date.now() - syncStartRef.current);
      }
      if (data.status === "failed") {
        toast.error(data.error || "Sync failed");
      } else {
        toast.success(data.message || "Sync completed");
      }
      queryClient.invalidateQueries({ queryKey: ["stock-history", symbol] });
      queryClient.invalidateQueries({ queryKey: ["stock-sync-status", symbol] });
    },
    onError: (err: unknown) => {
      if (syncStartRef.current) {
        setLastSyncDuration(Date.now() - syncStartRef.current);
      }
      toast.error(getApiErrorMessage(err, "Sync failed"));
    },
  });

  // Sync timer
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!syncMutation.isPending) {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [syncMutation.isPending]);

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}s`;
    }
    return `${seconds}.${tenths}s`;
  }

  // Auto-trigger sync once if history is empty and we haven't tried yet (authenticated only)
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
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

  const chartData = useMemo(() => {
    if (!historyQuery.data) return [];
    return aggregatePrices(historyQuery.data, resolution);
  }, [historyQuery.data, resolution]);

  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#0f172a",
      },
      grid: {
        vertLines: { color: "rgba(226,232,240,0.4)" },
        horzLines: { color: "rgba(226,232,240,0.4)" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: false,
      },
      autoSize: true,
    });

    const upColor = "#ef4444";
    const downColor = "#22c55e";

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceScaleId: "right",
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.05,
        bottom: 0.25,
      },
    });

    const sortedHistory = chartData
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const data: CandlestickData<Time>[] = sortedHistory.map((p) => ({
        time: p.date as Time,
        open: parseFloat(p.open_price),
        high: parseFloat(p.high_price),
        low: parseFloat(p.low_price),
        close: parseFloat(p.close_price),
      }));

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });

    const volumeData: HistogramData<Time>[] = sortedHistory.map((p) => {
      const open = parseFloat(p.open_price);
      const close = parseFloat(p.close_price);

      return {
        time: p.date as Time,
        value: p.volume,
        color: close >= open ? "rgba(239, 68, 68, 0.45)" : "rgba(34, 197, 94, 0.45)",
      };
    });

    candleSeries.setData(data);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData]);

  const quote = quoteQuery.data;
  const isUp = quote?.change ? parseFloat(quote.change) >= 0 : true;
  const syncStatus = syncStatusQuery.data;
  const isETF = symbol ? (symbol.startsWith("00") || symbol.length >= 5) : false;

  const resolutions: { label: string; value: Resolution }[] = [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Year", value: "year" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/stocks"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Market
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">{symbol}</h1>
            {isETF && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                ETF
              </span>
            )}
            {recommendationQuery.data && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide border ${
                recommendationQuery.data.recommendation === "buy"
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : recommendationQuery.data.recommendation === "sell"
                  ? "bg-rose-500 text-white border-rose-600"
                  : "bg-amber-500 text-white border-amber-600"
              }`}>
                {recommendationQuery.data.recommendation}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{quote?.name || "Loading..."}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add to Watchlist
              </button>
              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    {watchlistsQuery.data?.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        No watchlists.{" "}
                        <Link to="/watchlists" className="text-accent underline">
                          Create one
                        </Link>
                      </p>
                    )}
                    {watchlistsQuery.data?.map((wl) => (
                      <button
                        key={wl.id}
                        onClick={() => addItemMutation.mutate({ watchlistId: wl.id, symbol: symbol! })}
                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                      >
                        {wl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
              Login to add to watchlist
            </Link>
          )}
          {isAuthenticated && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? `Syncing… ${formatDuration(elapsedMs)}` : "Sync Market Data"}
            </button>
          )}
        </div>
      </div>

      {quote && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Price</p>
            <p className="text-xl font-bold text-primary">{quote.price}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Change</p>
            <div className={`flex items-center gap-1 text-xl font-bold ${isUp ? "text-danger" : "text-success"}`}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{quote.change ?? "-"}</span>
            </div>
            <p className={`text-xs ${isUp ? "text-danger" : "text-success"}`}>
              {quote.change_percent ? `${quote.change_percent}%` : ""}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Volume</p>
            <p className="text-xl font-bold text-primary">{quote.volume.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Range</p>
            <p className="text-sm font-medium text-primary">
              {quote.low} - {quote.high}
            </p>
            <p className="text-xs text-muted-foreground">Open: {quote.open}</p>
          </div>
        </div>
      )}

      {recommendationQuery.data && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">Technical Signal</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide border ${
              recommendationQuery.data.recommendation === "buy"
                ? "bg-emerald-500 text-white border-emerald-600"
                : recommendationQuery.data.recommendation === "sell"
                ? "bg-rose-500 text-white border-rose-600"
                : "bg-amber-500 text-white border-amber-600"
            }`}>
              {recommendationQuery.data.recommendation}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[200px]">
                <div
                  className={`h-full rounded-full ${
                    recommendationQuery.data.recommendation === "buy"
                      ? "bg-emerald-500"
                      : recommendationQuery.data.recommendation === "sell"
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${recommendationQuery.data.confidence}%` }}
                />
              </div>
              <span className="text-sm font-medium">{recommendationQuery.data.confidence}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Close", value: recommendationQuery.data.indicators.close },
              { label: "MA5", value: recommendationQuery.data.indicators.ma5 },
              { label: "MA20", value: recommendationQuery.data.indicators.ma20 },
              { label: "MA60", value: recommendationQuery.data.indicators.ma60 },
              { label: "RSI14", value: recommendationQuery.data.indicators.rsi14 },
            ].map((item) => (
              <div key={item.label} className="bg-muted rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                <p className="text-sm font-semibold text-primary">{item.value ?? "-"}</p>
              </div>
            ))}
          </div>

          <ul className="space-y-1 mb-3">
            {recommendationQuery.data.reasons.map((reason, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-accent shrink-0" />
                {reason}
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-muted-foreground italic">{recommendationQuery.data.disclaimer}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">Price History</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {syncStatus && (
              <div className="text-xs text-muted-foreground">
                <p>
                  Status:{" "}
                  <span className="font-medium text-primary">{syncStatus.status}</span>
                </p>
                <p>
                  Synced: {syncStatus.synced_from || "-"} to {syncStatus.synced_to || "-"}
                </p>
              </div>
            )}

            <div className="flex items-center gap-1 bg-muted border border-border rounded-md p-0.5">
              {resolutions.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setResolution(r.value)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    resolution === r.value
                      ? "bg-card text-primary shadow-sm border border-border"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-border rounded-md bg-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs px-2 py-1.5 border border-border rounded-md bg-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {historyQuery.isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        )}

        {historyQuery.data && historyQuery.data.length === 0 && !historyQuery.isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {syncMutation.isPending ? (
              <div className="flex items-center justify-center gap-2">
                <Timer className="w-4 h-4 animate-pulse" />
                <p>Syncing historical data… {formatDuration(elapsedMs)}</p>
              </div>
            ) : syncMutation.isError ? (
              <>
                <p>Sync failed.</p>
                {isAuthenticated && (
                  <button
                    onClick={() => syncMutation.mutate()}
                    className="mt-3 text-accent text-sm font-medium hover:underline"
                  >
                    Retry sync
                  </button>
                )}
              </>
            ) : (
              <>
                <p>No historical data available.</p>
                {isAuthenticated ? (
                  <button
                    onClick={() => syncMutation.mutate()}
                    className="mt-3 text-accent text-sm font-medium hover:underline"
                  >
                    Sync historical prices
                  </button>
                ) : (
                  <Link to="/login" className="mt-3 inline-block text-accent text-sm font-medium hover:underline">
                    Login to sync historical prices
                  </Link>
                )}
              </>
            )}
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: 520, display: chartData.length > 0 ? "block" : "none" }}
        />
        {lastSyncDuration !== null && chartData.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-right">
            Last sync took {formatDuration(lastSyncDuration)}
          </p>
        )}
      </div>
    </div>
  );
}
