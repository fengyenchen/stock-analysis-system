import { create } from "zustand";
import type { User, TokenPair } from "@/types";
import { setTokens, clearTokens } from "@/api/client";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuth: (user: User, tokens: TokenPair) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isAdmin: user?.role === "admin" }),
  setAuth: (user, tokens) => {
    setTokens(tokens);
    set({ user, isAuthenticated: true, isAdmin: user.role === "admin", isLoading: false });
  },
  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false, isAdmin: false, isLoading: false });
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));
