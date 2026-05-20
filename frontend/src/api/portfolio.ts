import { apiClient } from "./client";
import type { PortfolioPosition, PortfolioTransaction } from "@/types";

export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  const res = await apiClient.get<PortfolioPosition[]>("portfolio/positions");
  return res.data;
}

export async function getPortfolioPosition(symbol: string): Promise<PortfolioPosition> {
  const res = await apiClient.get<PortfolioPosition>(`portfolio/positions/${symbol}`);
  return res.data;
}

export async function createTransaction(data: {
  symbol: string;
  transaction_type: "buy" | "sell";
  shares: string;
  price: string;
  transaction_date?: string;
}): Promise<PortfolioTransaction> {
  const res = await apiClient.post<PortfolioTransaction>("portfolio/transactions", data);
  return res.data;
}
