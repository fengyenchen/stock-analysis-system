import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useHaptic } from "@/hooks/useHaptic";
import {
  Home,
  Search,
  List,
  Wallet,
  User,
} from "lucide-react";

interface TabItem {
  path: string;
  label: string;
  icon: React.ElementType;
  protected?: boolean;
}

const tabs: TabItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/stocks", label: "Stocks", icon: Search },
  { path: "/watchlists", label: "Lists", icon: List, protected: true },
  { path: "/portfolio", label: "Portfolio", icon: Wallet, protected: true },
  { path: "/profile", label: "Profile", icon: User, protected: true },
];

export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  const { trigger: haptic } = useHaptic();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleTabClick = (tab: TabItem, e: React.MouseEvent) => {
    haptic(8);
    if (tab.protected && !isAuthenticated) {
      e.preventDefault();
      navigate("/login", { state: { from: tab.path } });
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.protected && !isAuthenticated ? "#" : tab.path}
              onClick={(e) => handleTabClick(tab, e)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[48px] transition-colors ${
                active
                  ? "text-accent"
                  : "text-muted-foreground"
              }`}
              aria-label={tab.label}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                  active ? "bg-accent/10" : ""
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
