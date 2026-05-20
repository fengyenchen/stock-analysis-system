import { apiClient } from "@/api/client";
import type { User } from "@/types";

export interface UserAdminUpdatePayload {
  is_active?: boolean;
  role?: "user" | "admin";
}

export async function getUsers(skip = 0, limit = 20): Promise<User[]> {
  const resp = await apiClient.get(`/admin/users?skip=${skip}&limit=${limit}`);
  return resp.data;
}

export async function getUser(userId: number): Promise<User> {
  const resp = await apiClient.get(`/admin/users/${userId}`);
  return resp.data;
}

export async function updateUser(userId: number, payload: UserAdminUpdatePayload): Promise<User> {
  const resp = await apiClient.patch(`/admin/users/${userId}`, payload);
  return resp.data;
}

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`);
}
