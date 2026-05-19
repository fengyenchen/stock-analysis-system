import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Radio, Search, SlidersHorizontal, X } from "lucide-react";
import { EmptyStockState } from "@/components/stock/EmptyStockState";
import { StockCardSkeleton } from "@/components/stock/StockCardSkeleton";
import { StockListCard } from "@/components/stock/StockListCard";
import { getStock, getStockQuote, getStockRecommendation } from "@/api/stocks";
import { useStockSearch } from "@/hooks/useStockSearch";

export function StockSearchPage() {
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    assetType,
    setAssetType,
    selectedIndustry,
    setSelectedIndustry,
    visibleResults,
    filteredResults,
    isLoading,
    industries,
    sentinelRef,
    hasActiveFilters,
    clearFilters,
    summariesMap,
    liveQuotes,
    sseConnected,
  } = useStockSearch();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        clearFilters();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFilters]);

  const handleMouseEnter = useCallback(
    (symbol: string) => {
      queryClient.prefetchQuery({
        queryKey: ["stock", symbol],
        queryFn: () => getStock(symbol),
        staleTime: 300_000,
      });
      queryClient.prefetchQuery({
        queryKey: ["stock-quote", symbol],
        queryFn: () => getStockQuote(symbol),
        staleTime: 60_000,
      });
      queryClient.prefetchQuery({
        queryKey: ["stock-recommendation", symbol],
        queryFn: () => getStockRecommendation(symbol),
        staleTime: 300_000,
      });
    },
    [queryClient]
  );

  return (
    <div className="space-y-6 px-4 md:px-0 py-4 md:py-0">
      <h1 className="text-2xl font-bold text-primary">Stocks</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search by symbol or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 py-3 bg-background/80 backdrop-blur border-y border-border space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {(["all", "stocks", "etfs"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setAssetType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                assetType === type
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {type === "all" ? "All" : type === "stocks" ? "Stocks" : "ETFs"}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {industries.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {industries.map((industry) => (
              <button
                key={industry}
                onClick={() =>
                  setSelectedIndustry(selectedIndustry === industry ? null : industry)
                }
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                  selectedIndustry === industry
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {industry}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isLoading && filteredResults.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min(visibleResults.length, filteredResults.length)} of{" "}
            {filteredResults.length} stocks
            {selectedIndustry ? ` in ${selectedIndustry}` : ""}
          </p>
          {sseConnected && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Live</span>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <StockCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && filteredResults.length === 0 && (
        <EmptyStockState hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
      )}

      {!isLoading && visibleResults.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleResults.map((stock, index) => {
              const delays = ["delay-100", "delay-200", "delay-300", "delay-400", "delay-500"];
              const delayClass = delays[index % delays.length];
              const summary = summariesMap.get(stock.symbol);
              const liveQuote = liveQuotes.get(stock.symbol);
              const price = liveQuote?.price ?? summary?.price ?? null;
              const changePercent =
                liveQuote?.change_percent ?? summary?.change_percent ?? null;

              return (
                <div
                  key={stock.symbol}
                  className={`animate-fade-in-up ${delayClass}`}
                  onMouseEnter={() => handleMouseEnter(stock.symbol)}
                >
                  <StockListCard
                    stock={stock}
                    price={price}
                    changePercent={changePercent}
                    recommendation={summary?.recommendation}
                    sparklineData={summary?.sparkline_data}
                    isEtf={stock.is_etf ?? undefined}
                  />
                </div>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-4" />

          {visibleResults.length >= filteredResults.length && (
            <p className="text-center text-sm text-muted-foreground py-4">
              All {filteredResults.length} stocks shown
            </p>
          )}
        </>
      )}
    </div>
  );
}
