import { apiClient } from "@/api/client";
import type { ContentVisibility, ContentVisibilityEffective } from "@/types";

export async function getMyContentVisibility(): Promise<ContentVisibilityEffective[]> {
  const resp = await apiClient.get("/content-visibility");
  return resp.data;
}

export async function getPublicContentVisibility(): Promise<ContentVisibilityEffective[]> {
  const resp = await apiClient.get("/content-visibility/public");
  return resp.data;
}

export async function setGlobalVisibility(contentKey: string, isVisible: boolean): Promise<ContentVisibility> {
  const resp = await apiClient.patch(`/admin/content-visibility/global/${contentKey}`, { is_visible: isVisible });
  return resp.data;
}

export async function setUserVisibility(userId: number, contentKey: string, isVisible: boolean): Promise<ContentVisibility> {
  const resp = await apiClient.patch(`/admin/content-visibility/users/${userId}/${contentKey}`, { is_visible: isVisible });
  return resp.data;
}

export async function deleteUserVisibility(userId: number, contentKey: string): Promise<void> {
  await apiClient.delete(`/admin/content-visibility/users/${userId}/${contentKey}`);
}

export async function listAllVisibility(): Promise<ContentVisibility[]> {
  const resp = await apiClient.get("/admin/content-visibility");
  return resp.data;
}
