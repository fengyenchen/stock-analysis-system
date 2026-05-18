import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { listWatchlists } from "@/api/watchlists";
import { Search, List, ChevronRight, BarChart2, Sparkles, BrainCircuit, Activity } from "lucide-react";

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

  const selectedWl = watchlists?.find((wl) => wl.id.toString() === primaryWlId) ?? null;
  const primaryWl = selectedWl ?? watchlists?.[0] ?? null;
  const selectedWlId = selectedWl?.id.toString() ?? primaryWl?.id.toString() ?? "";
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-6 h-full">
            {showHeroSearch ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-primary mb-1">
                    探索台股，從這裡開始
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Search Taiwan stocks by symbol or company name.
                  </p>
                </div>
                <form onSubmit={handleSearch} className="flex gap-2">
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
                      value={selectedWlId}
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
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors group"
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

        {/* Right panel — AI Insights */}
        <div>
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-xl p-6 h-full shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <BrainCircuit className="w-32 h-32 text-indigo-500" />
            </div>

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center gap-2 mb-5">
                <div className="p-1.5 bg-indigo-500 rounded-lg shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-semibold text-indigo-950">AI 交易洞察</h2>
              </div>

              <div className="space-y-3 flex-1">
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white shadow-sm">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Watchlist Summary
                  </h3>
                  <p className="text-sm text-indigo-950 leading-relaxed font-medium">
                    {!isAuthenticated
                      ? "登入後可根據你的觀察清單產生個人化摘要。"
                      : primaryWl && primaryWl.items.length > 0
                        ? `目前觀察清單「${primaryWl.name}」包含 ${primaryWl.items.length} 檔標的，可作為後續分析範圍。`
                        : "目前尚未加入觀察標的，建立清單後即可開始累積分析脈絡。"}
                  </p>
                </div>

                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white shadow-sm">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BrainCircuit className="w-3 h-3" /> Analysis Status
                  </h3>
                  <p className="text-sm text-indigo-950 leading-relaxed font-medium">
                    模擬 AI 分析面板已啟用。此區塊目前僅呈現產品體驗，不構成任何投資建議。
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-auto flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Preview
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-white/60 px-2 py-1 rounded-md border border-indigo-100">
                  <Sparkles className="w-3 h-3" /> Simulated
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market sector section */}
      <div className="bg-card border border-border rounded-xl p-6">
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
