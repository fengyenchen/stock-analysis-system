import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, updateUser, deleteUser } from "@/api/admin";
import {
  setGlobalVisibility,
  setUserVisibility,
  deleteUserVisibility,
  listAllVisibility,
} from "@/api/contentVisibility";
import { toast } from "sonner";
import {
  Shield,
  Trash2,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Users,
  Eye,
  EyeOff,
  LayoutTemplate,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";


const CONTENT_LABELS: Record<string, string> = {
  recommendation_banner: "Recommendation Banner",
  metrics_strip: "Metrics Strip",
  stock_header: "Stock Header",
  price_chart: "Price Chart",
  technical_indicators: "Technical Indicators",
  analysis_points: "Analysis Points",
  quick_stats_grid: "Quick Stats Grid",
  key_metrics_grid: "Key Metrics Grid",
  analyst_consensus: "Analyst Consensus",
  related_stocks: "Related Stocks",
  financial_health_scores: "Financial Health Scores",
  quick_actions: "Quick Actions",
  signal_summary: "Signal Summary",
  risk_assessment: "Risk Assessment",
  support_resistance: "Support / Resistance",
  peer_comparison: "Peer Comparison",
  sync_csv_actions: "Sync & CSV Actions",
  alert_form: "Alert Form",
};

const CONTENT_KEYS = Object.keys(CONTENT_LABELS);

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "visibility">("users");
  const [userSkip, setUserSkip] = useState(0);
  const userLimit = 20;
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  /* ─── Users tab ─── */
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", userSkip, userLimit],
    queryFn: () => getUsers(userSkip, userLimit),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to delete user");
    },
  });

  /* ─── Visibility tab ─── */
  const { data: allVisibility } = useQuery({
    queryKey: ["admin-content-visibility"],
    queryFn: listAllVisibility,
  });

  const globalVisMutation = useMutation({
    mutationFn: ({ key, visible }: { key: string; visible: boolean }) => setGlobalVisibility(key, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["content-visibility"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update visibility");
    },
  });

  const userVisMutation = useMutation({
    mutationFn: ({ userId, key, visible }: { userId: number; key: string; visible: boolean }) =>
      setUserVisibility(userId, key, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["content-visibility"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update visibility");
    },
  });

  const deleteUserVisMutation = useMutation({
    mutationFn: ({ userId, key }: { userId: number; key: string }) => deleteUserVisibility(userId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["content-visibility"] });
    },
  });

  const handleToggleRole = (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    updateMutation.mutate({ userId, payload: { role: newRole } });
  };

  const handleToggleActive = (userId: number, currentActive: boolean) => {
    updateMutation.mutate({ userId, payload: { is_active: !currentActive } });
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      deleteMutation.mutate(userId);
    }
  };

  const getGlobalVisible = (key: string) => {
    const global = allVisibility?.find((v) => v.scope === "global" && v.content_key === key);
    return global?.is_visible ?? true;
  };

  const getUserOverride = (userId: number, key: string) => {
    return allVisibility?.find((v) => v.scope === "user" && v.user_id === userId && v.content_key === key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "users" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab("visibility")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "visibility" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          Content Visibility
        </button>
      </div>

      {/* ─── Users Tab ─── */}
      {activeTab === "users" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{user.id}</td>
                    <td className="px-4 py-3 font-medium text-primary">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "success" : "danger"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleRole(user.id, user.role)}
                          disabled={updateMutation.isPending}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                          title="Toggle role"
                        >
                          {user.role === "admin" ? <UserX className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          disabled={updateMutation.isPending}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                          title="Toggle active"
                        >
                          {user.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-muted-foreground hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users?.length === 0 && !usersLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No users found.</p>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button
              onClick={() => setUserSkip((s) => Math.max(0, s - userLimit))}
              disabled={userSkip === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {Math.floor(userSkip / userLimit) + 1}
            </span>
            <button
              onClick={() => setUserSkip((s) => s + userLimit)}
              disabled={(users?.length ?? 0) < userLimit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Content Visibility Tab ─── */}
      {activeTab === "visibility" && (
        <div className="space-y-6">
          {/* Global toggles */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" />
              Global Defaults
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              These settings apply to all users unless overridden per-user below.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CONTENT_KEYS.map((key) => {
                const visible = getGlobalVisible(key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm font-medium">{CONTENT_LABELS[key]}</span>
                    <button
                      onClick={() => globalVisMutation.mutate({ key, visible: !visible })}
                      disabled={globalVisMutation.isPending}
                      className={`p-1.5 rounded-md transition-colors ${
                        visible
                          ? "text-success hover:bg-green-50"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      title={visible ? "Visible" : "Hidden"}
                    >
                      {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-user overrides */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Per-User Overrides
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select a user to set individual overrides. Overrides take precedence over global defaults.
            </p>

            <div className="mb-4">
              <select
                value={selectedUserId ?? ""}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm w-full sm:w-72"
              >
                <option value="">Select a user…</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedUserId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Overrides for {users?.find((u) => u.id === selectedUserId)?.username}
                  </h3>
                  <button
                    onClick={() => {
                      const user = users?.find((u) => u.id === selectedUserId);
                      if (!user) return;
                      CONTENT_KEYS.forEach((key) => {
                        const override = getUserOverride(selectedUserId, key);
                        if (override) {
                          deleteUserVisMutation.mutate({ userId: selectedUserId, key });
                        }
                      });
                      toast.success(`Cleared all overrides for ${user.username}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset all to global
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CONTENT_KEYS.map((key) => {
                    const globalVisible = getGlobalVisible(key);
                    const override = getUserOverride(selectedUserId, key);
                    const effective = override ? override.is_visible : globalVisible;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                          override ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{CONTENT_LABELS[key]}</span>
                          <span className="text-xs text-muted-foreground">
                            Global: {globalVisible ? "Visible" : "Hidden"}
                            {override && " • Overridden"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              userVisMutation.mutate({ userId: selectedUserId, key, visible: !effective })
                            }
                            disabled={userVisMutation.isPending}
                            className={`p-1.5 rounded-md transition-colors ${
                              effective ? "text-success hover:bg-green-50" : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {effective ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          {override && (
                            <button
                              onClick={() =>
                                deleteUserVisMutation.mutate({ userId: selectedUserId, key })
                              }
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
                              title="Revert to global"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
