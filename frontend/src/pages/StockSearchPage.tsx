import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { searchStocks, listStocks } from "@/api/stocks";
import {
  ArrowRight,
  Cpu,
  Landmark,
  Loader2,
  Monitor,
  Pill,
  Radio,
  Search,
  Settings,
  Ship,
  Utensils,
} from "lucide-react";

const INDUSTRIES = [
  { id: "semiconductor", name: "半導體業", icon: Cpu },
  { id: "computer", name: "電腦及週邊設備業", icon: Monitor },
  { id: "electronic", name: "電子零組件業", icon: Settings },
  { id: "network", name: "通信網路業", icon: Radio },
  { id: "finance", name: "金融保險業", icon: Landmark },
  { id: "shipping", name: "航運業", icon: Ship },
  { id: "medical", name: "生技醫療業", icon: Pill },
  { id: "food", name: "食品工業", icon: Utensils },
];

type AssetType = "all" | "stock" | "etf";
type PerformanceFilter = "none" | "gainers" | "losers";

const BATCH_SIZE = 40;

function getMockChange(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const random = Math.abs(Math.sin(hash));
  return parseFloat((random * 10 - 5).toFixed(2));
}

export function StockSearchPage() {
  const location = useLocation();
  const [query, setQuery] = useState(
    (location.state as { initialQuery?: string } | null)?.initialQuery ?? ""
  );
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<AssetType>("all");
  const [performance, setPerformance] = useState<PerformanceFilter>("none");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const searchQuery = useQuery({
    queryKey: ["stock-search", query],
    queryFn: () => searchStocks(query),
    enabled: query.length > 0,
  });

  const allQuery = useQuery({
    queryKey: ["stocks", 0, 3000],
    queryFn: () => listStocks(0, 3000),
    enabled: query.length === 0,
  });

  const rawResults = useMemo(() => {
    if (query.length > 0) return searchQuery.data || [];
    return allQuery.data || [];
  }, [query, searchQuery.data, allQuery.data]);

  const isLoading = query.length > 0 ? searchQuery.isLoading : allQuery.isLoading;

  const filteredResults = useMemo(() => {
    let filtered = rawResults.map((stock) => {
      const changePercent = getMockChange(stock.symbol);
      const isEtf = stock.symbol.startsWith("00") || stock.symbol.length >= 5;
      return { ...stock, changePercent, isEtf };
    });

    if (selectedIndustry) filtered = filtered.filter((stock) => stock.industry === selectedIndustry);
    if (assetType === "stock") filtered = filtered.filter((stock) => !stock.isEtf);
    else if (assetType === "etf") filtered = filtered.filter((stock) => stock.isEtf);

    if (performance === "gainers") {
      filtered = filtered
        .filter((stock) => stock.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent);
    } else if (performance === "losers") {
      filtered = filtered
        .filter((stock) => stock.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent);
    } else {
      filtered = [...filtered].sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    return filtered;
  }, [rawResults, selectedIndustry, assetType, performance]);

  const visibleResults = filteredResults.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResults.length;

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [query, selectedIndustry, assetType, performance]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => prev + BATCH_SIZE);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Explore Market</h1>
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search symbol or name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length > 0) {
                setSelectedIndustry(null);
                setAssetType("all");
                setPerformance("none");
              }
            }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asset Type</span>
            <div className="flex bg-muted p-1 rounded-lg">
              {(["all", "stock", "etf"] as AssetType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setAssetType(type)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    assetType === type ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {type === "all" ? "All" : type === "stock" ? "Stocks" : "ETFs"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Perf.</span>
            <div className="flex bg-muted p-1 rounded-lg">
              {(["none", "gainers", "losers"] as PerformanceFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPerformance(filter)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    performance === filter ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {filter === "none" ? "Default" : filter === "gainers" ? "Gainers" : "Losers"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Industry Quick Filters</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedIndustry(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedIndustry === null
                  ? "bg-accent border-accent text-accent-foreground"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            {INDUSTRIES.map((industry) => {
              const Icon = industry.icon;
              return (
                <button
                  key={industry.id}
                  onClick={() => {
                    setSelectedIndustry(selectedIndustry === industry.name ? null : industry.name);
                    setQuery("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedIndustry === industry.name
                      ? "bg-accent border-accent text-accent-foreground"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {industry.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin h-10 w-10 text-accent" />
        </div>
      )}

      {!isLoading && filteredResults.length === 0 && (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <p className="text-lg font-medium text-primary">No matching stocks found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
      )}

      {!isLoading && visibleResults.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleResults.map((stock) => (
              <Link
                key={stock.symbol}
                to={`/stocks/${stock.symbol}`}
                className="bg-card border border-border rounded-xl p-4 hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary group-hover:text-accent transition-colors">{stock.symbol}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        stock.isEtf ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {stock.isEtf ? "ETF" : stock.market}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-primary truncate max-w-[120px]">{stock.name}</p>
                    <p className="text-xs text-muted-foreground">{stock.industry || "N/A"}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <div className={`text-sm font-bold px-2 py-1 rounded ${
                      stock.changePercent > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                    }`}>
                      {stock.changePercent > 0 ? "+" : ""}{stock.changePercent}%
                    </div>
                    <div className="bg-muted p-1.5 rounded-lg group-hover:bg-accent/10 transition-colors inline-block">
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div
              ref={sentinelRef}
              id="infinite-scroll-sentinel"
              className="flex justify-center py-12 min-h-[100px]"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin w-4 h-4" />
                Loading more stocks...
              </div>
            </div>
          )}

          {!hasMore && visibleResults.length > 0 && (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">You've reached the end of the list.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
