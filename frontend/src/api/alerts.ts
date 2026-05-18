import { apiClient } from "./client";
import type { PriceAlert } from "@/types";

export async function listAlerts(active_only?: boolean): Promise<PriceAlert[]> {
  const res = await apiClient.get<PriceAlert[]>("price-alerts", {
    params: active_only !== undefined ? { active_only } : {},
  });
  return res.data;
}

export async function createAlert(data: {
  symbol: string;
  condition: "above" | "below";
  target_price: string;
}): Promise<PriceAlert> {
  const res = await apiClient.post<PriceAlert>("price-alerts", data);
  return res.data;
}

export async function updateAlert(
  alertId: number,
  data: Partial<Pick<PriceAlert, "is_active" | "target_price" | "condition">>
): Promise<PriceAlert> {
  const res = await apiClient.patch<PriceAlert>(`price-alerts/${alertId}`, data);
  return res.data;
}

export async function deleteAlert(alertId: number): Promise<void> {
  await apiClient.delete(`price-alerts/${alertId}`);
}
