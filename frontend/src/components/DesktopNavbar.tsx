import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { logout as apiLogout } from "@/api/auth";
import { clearTokens, getAccessToken } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import {
  Search,
  List,
  LogOut,
  LogIn,
  TrendingUp,
  Moon,
  Sun,
  Bell,
  Wallet,
  ChevronDown,
  Settings,
  Shield,
} from "lucide-react";

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function DesktopNavbar() {
  const { user, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      const token = getAccessToken();
      if (token) await apiLogout(token);
    } catch {
      // ignore
    } finally {
      clearTokens();
      storeLogout();
      queryClient.removeQueries({ queryKey: ["watchlists"] });
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  const navLinkClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      location.pathname === path || location.pathname.startsWith(path + "/")
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:text-primary hover:bg-muted"
    }`;

  return (
    <div className="hidden md:block">
      <nav className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
              <TrendingUp className="w-5 h-5 text-accent" />
              <span>TW Stock</span>
            </Link>

            <div className="flex items-center gap-1">
              <Link to="/stocks" className={navLinkClass("/stocks")}>
                <Search className="w-4 h-4" />
                <span>Stocks</span>
              </Link>
              <Link to="/watchlists" className={navLinkClass("/watchlists")}>
                <List className="w-4 h-4" />
                <span>Watchlists</span>
              </Link>
              <Link to="/portfolio" className={navLinkClass("/portfolio")}>
                <Wallet className="w-4 h-4" />
                <span>Portfolio</span>
              </Link>
              {user?.role === "admin" && (
                <Link to="/admin" className={navLinkClass("/admin")}>
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>

              {user ? (
                <>
                  <Link
                    to="/alerts"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary px-2 py-2 rounded-lg transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                  </Link>

                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                      aria-haspopup="menu"
                      aria-expanded={dropdownOpen}
                    >
                      <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold">
                        {getInitials(user.username)}
                      </div>
                      <span className="font-medium">{user.username}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-sm font-medium text-primary truncate">{user.username}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Profile
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
