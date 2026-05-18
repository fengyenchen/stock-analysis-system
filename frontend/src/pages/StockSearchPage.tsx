import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { searchStocks, listStocks } from "@/api/stocks";
import { Search, ArrowRight, SlidersHorizontal } from "lucide-react";

// Approximate heuristic: symbols starting with "00" or 5+ chars are typically ETFs on TWSE/TPEx
const isEtf = (symbol: string) => symbol.startsWith("00") || symbol.length >= 5;

export function StockSearchPage() {
  const location = useLocation();
  const [query, setQuery] = useState<string>(
    (location.state as { initialQuery?: string } | null)?.initialQuery ?? ""
  );
  const [assetType, setAssetType] = useState<"all" | "stocks" | "etfs">("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const searchQuery = useQuery({
    queryKey: ["stock-search", query],
    queryFn: () => searchStocks(query),
    enabled: query.length > 0,
  });

  const allQuery = useQuery({
    queryKey: ["stocks-all"],
    queryFn: () => listStocks(0, 200),
    enabled: query.length === 0,
  });

  const rawResults = query.length > 0 ? (searchQuery.data ?? []) : (allQuery.data ?? []);
  const isLoading = query.length > 0 ? searchQuery.isLoading : allQuery.isLoading;

  const industries = useMemo(() => {
    const set = new Set<string>();
    rawResults.forEach((s) => { if (s.industry) set.add(s.industry); });
    return Array.from(set).sort();
  }, [rawResults]);

  const filteredResults = rawResults.filter((stock) => {
    if (assetType === "etfs" && !isEtf(stock.symbol)) return false;
    if (assetType === "stocks" && isEtf(stock.symbol)) return false;
    if (selectedIndustry && stock.industry !== selectedIndustry) return false;
    return true;
  });

  const visibleResults = filteredResults.slice(0, visibleCount);

  useEffect(() => {
    setSelectedIndustry(null);
    setVisibleCount(40);
  }, [query]);

  useEffect(() => {
    setVisibleCount(40);
  }, [assetType, selectedIndustry]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= filteredResults.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((n) => n + 40);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredResults.length]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Stocks</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by symbol or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {(["all", "stocks", "etfs"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setAssetType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                assetType === type
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {type === "all" ? "All" : type === "stocks" ? "Stocks" : "ETFs"}
            </button>
          ))}
        </div>

        {industries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(selectedIndustry === ind ? null : ind)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedIndustry === ind
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isLoading && rawResults.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {Math.min(visibleCount, filteredResults.length)} of {filteredResults.length} stocks
          {selectedIndustry ? ` in ${selectedIndustry}` : ""}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      )}

      {!isLoading && filteredResults.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No stocks found.</p>
        </div>
      )}

      {!isLoading && visibleResults.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleResults.map((stock) => (
              <Link
                key={stock.symbol}
                to={`/stocks/${stock.symbol}`}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-primary">{stock.symbol}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {stock.market}
                      </span>
                      {isEtf(stock.symbol) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          ETF
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{stock.name}</p>
                    {stock.industry && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{stock.industry}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>

          <div ref={sentinelRef} className="h-4" />

          {visibleCount >= filteredResults.length && (
            <p className="text-center text-sm text-muted-foreground py-4">
              All {filteredResults.length} stocks shown
            </p>
          )}
        </>
      )}
    </div>
  );
}
