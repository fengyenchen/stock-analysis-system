import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAlerts, deleteAlert, updateAlert } from "@/api/alerts";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { Bell, Trash2, ToggleLeft, ToggleRight, TrendingUp, TrendingDown } from "lucide-react";

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [showActiveOnly, setShowActiveOnly] = useState<boolean | undefined>(undefined);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", showActiveOnly],
    queryFn: () => listAlerts(showActiveOnly),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      toast.success("Alert deleted");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("Failed to delete alert"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateAlert(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("Failed to update alert"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-bold text-primary">Price Alerts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showActiveOnly === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setShowActiveOnly(undefined)}
          >
            All
          </Button>
          <Button
            variant={showActiveOnly === true ? "default" : "outline"}
            size="sm"
            onClick={() => setShowActiveOnly(true)}
          >
            Active
          </Button>
          <Button
            variant={showActiveOnly === false ? "default" : "outline"}
            size="sm"
            onClick={() => setShowActiveOnly(false)}
          >
            Inactive
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {alerts && alerts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No price alerts yet.</p>
            <p className="text-sm mt-1">Create alerts from a stock detail page.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {alerts?.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      alert.condition === "above" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {alert.condition === "above" ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">{alert.symbol}</span>
                      <Badge variant={alert.is_active ? "success" : "secondary"}>
                        {alert.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.condition === "above" ? "Above" : "Below"} {alert.target_price}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: alert.id, is_active: !alert.is_active })}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={alert.is_active ? "Deactivate" : "Activate"}
                  >
                    {alert.is_active ? (
                      <ToggleRight className="w-6 h-6 text-success" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(alert.id)}
                    className="text-muted-foreground hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
