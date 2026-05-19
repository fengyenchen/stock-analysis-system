import { useQuery } from "@tanstack/react-query";
import { getMyContentVisibility, getPublicContentVisibility } from "@/api/contentVisibility";
import { useAuthStore } from "@/stores/authStore";
import { useMemo } from "react";

export function useContentVisibility() {
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["content-visibility"],
    queryFn: () => (isAuthenticated ? getMyContentVisibility() : getPublicContentVisibility()),
  });

  const visibilityMap = useMemo(() => {
    if (!data) return {} as Record<string, boolean>;
    return Object.fromEntries(data.map((item) => [item.content_key, item.is_visible]));
  }, [data]);

  const isVisible = (key: string) => {
    if (isLoading) return true; // default visible while loading
    return visibilityMap[key] ?? true;
  };

  return { isVisible, isLoading };
}
