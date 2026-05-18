import { apiClient } from "./client";
import type {
  Stock,
  StockPrice,
  StockQuote,
  StockRecommendation,
  StockSyncJob,
  StockSyncStatus,
  StockTargetPrice,
} from "@/types";

export async function searchStocks(q: string): Promise<Stock[]> {
  const res = await apiClient.get<Stock[]>("stocks", {
    params: { q },
  });
  return res.data;
}

export async function listStocks(offset = 0, limit = 100): Promise<Stock[]> {
  const res = await apiClient.get<Stock[]>("stocks", { params: { offset, limit } });
  return res.data;
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const res = await apiClient.get<StockQuote>(`stocks/${symbol}/quotes/latest`);
  return res.data;
}

export async function getStockHistory(
  symbol: string,
  start?: string,
  end?: string
): Promise<StockPrice[]> {
  const res = await apiClient.get<StockPrice[]>(`stocks/${symbol}/prices`, {
    params: { start, end },
  });
  return res.data;
}

export async function exportStockHistoryCSV(
  symbol: string,
  start?: string,
  end?: string
): Promise<Blob> {
  const res = await apiClient.get(`stocks/${symbol}/prices`, {
    params: { start, end, format: "csv" },
    responseType: "blob",
  });
  return res.data;
}

export async function getStockSyncStatus(symbol: string): Promise<StockSyncStatus> {
  const res = await apiClient.get<StockSyncStatus>(`stocks/${symbol}/sync-status`);
  return res.data;
}

export async function getStockRecommendation(symbol: string): Promise<StockRecommendation> {
  const res = await apiClient.get<StockRecommendation>(`stocks/${symbol}/recommendation`);
  return res.data;
}

export async function syncStockPrices(
  symbol: string,
  start?: string,
  end?: string
): Promise<StockSyncJob> {
  const res = await apiClient.post<StockSyncJob>("stock-sync-jobs", {
    symbol,
    start,
    end,
  });
  return res.data;
}

export async function getTargetPrices(symbol: string): Promise<StockTargetPrice[]> {
  const res = await apiClient.get<StockTargetPrice[]>(`stocks/${symbol}/target-prices`);
  return res.data;
}
