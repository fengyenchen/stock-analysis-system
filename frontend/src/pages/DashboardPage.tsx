import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { listWatchlists } from "@/api/watchlists";
import { Search, TrendingUp, List, ChevronRight, BarChart2 } from "lucide-react";

export function DashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [primaryWlId, setPrimaryWlId] = useState<string | null>(
    () => localStorage.getItem("primaryWatchlistId")
  );

  const { data: watchlists, isLoading: wlLoading } = useQuery({
    queryKey: ["watchlists"],
    queryFn: listWatchlists,
    enabled: isAuthenticated,
  });

  // Discard stale primaryWlId if the watchlist no longer exists
  useEffect(() => {
    if (watchlists && primaryWlId) {
      const stillExists = watchlists.some((wl) => wl.id.toString() === primaryWlId);
      if (!stillExists) {
        setPrimaryWlId(null);
        localStorage.removeItem("primaryWatchlistId");
      }
    }
  }, [watchlists, primaryWlId]);

  // Auto-select first watchlist when none is pinned
  useEffect(() => {
    if (watchlists && watchlists.length > 0 && !primaryWlId) {
      const id = watchlists[0].id.toString();
      setPrimaryWlId(id);
      localStorage.setItem("primaryWatchlistId", id);
    }
  }, [watchlists, primaryWlId]);

  const primaryWl = watchlists?.find((wl) => wl.id.toString() === primaryWlId) ?? null;
  const showHeroSearch =
    !isAuthenticated || wlLoading || !primaryWl || primaryWl.items.length === 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/stocks", {
      state: searchQuery.trim() ? { initialQuery: searchQuery.trim() } : undefined,
    });
  };

  const handleWatchlistChange = (id: string) => {
    setPrimaryWlId(id);
    localStorage.setItem("primaryWatchlistId", id);
  };

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0 py-3 md:py-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-4 md:p-6 h-full">
            {showHeroSearch ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-primary mb-1">
                    探索台股，從這裡開始
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Search Taiwan stocks by symbol or company name.
                  </p>
                </div>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="e.g. 2330 or 台積電"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    Search
                  </button>
                </form>
                {isAuthenticated && !wlLoading && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">
                      {watchlists && watchlists.length > 0
                        ? "Your pinned watchlist is empty."
                        : "You have no watchlists yet."}
                    </p>
                    <Link
                      to="/watchlists"
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <List className="w-4 h-4" />
                      {watchlists && watchlists.length > 0
                        ? "Add stocks to your watchlist"
                        : "Create your first watchlist"}
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-accent" />
                    <h2 className="text-base font-semibold text-primary">Watchlist</h2>
                  </div>
                  {watchlists && watchlists.length > 1 && (
                    <select
                      value={primaryWlId ?? ""}
                      onChange={(e) => handleWatchlistChange(e.target.value)}
                      className="text-sm px-2 py-1 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {watchlists.map((wl) => (
                        <option key={wl.id} value={wl.id.toString()}>
                          {wl.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {watchlists && watchlists.length === 1 && (
                    <span className="text-sm text-muted-foreground">{primaryWl!.name}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {primaryWl!.items.map((stock) => (
                    <Link
                      key={stock.symbol}
                      to={`/stocks/${stock.symbol}`}
                      className="flex items-center justify-between p-3 md:p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
                    >
                      <div>
                        <span className="font-semibold text-primary text-sm">{stock.symbol}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{stock.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            {stock.market}
                          </span>
                          {stock.industry && (
                            <span className="text-xs text-muted-foreground">{stock.industry}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/watchlists/${primaryWl!.id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
                >
                  View full watchlist <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Quick Links */}
        <div>
          <div className="bg-card border border-border rounded-xl p-4 md:p-6 h-full space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h2 className="text-base font-semibold text-primary">Quick Links</h2>
            </div>
            <div className="space-y-2">
              <Link
                to="/stocks"
                className="flex items-center gap-2 p-3 md:p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
              >
                <Search className="w-4 h-4 text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">Search Stocks</p>
                  <p className="text-xs text-muted-foreground">Browse TWSE & TPEx listings</p>
                </div>
              </Link>
              <Link
                to="/watchlists"
                className="flex items-center gap-2 p-3 md:p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
              >
                <List className="w-4 h-4 text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">Watchlists</p>
                  <p className="text-xs text-muted-foreground">
                    {isAuthenticated ? "Manage your stock watchlists" : "Login to track stocks"}
                  </p>
                </div>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              All prices are delayed data sourced from twstock. For real-time data,
              visit the stock detail page.
            </p>
          </div>
        </div>
      </div>

      {/* Market sector section */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-primary">Market Sectors</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          市場板塊數據即將推出 — Market sector data coming soon.
        </p>
      </div>
    </div>
  );
}
