import { useMemo } from "react";
import { Bot, Brain, CheckCircle2, CircleDot, FileText, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AIAnalysisResponse, AIAnalysisResult } from "@/types";
import {
  getResolvedAIAnalysis,
  isActiveAIAnalysisJob,
  isAIAnalysisJob,
} from "@/lib/aiAnalysis";

type AIAnalysisPanelProps = {
  title?: string;
  symbol?: string;
  stockName?: string;
  data?: AIAnalysisResult | null;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  isAuthenticated?: boolean;
  onRefresh?: () => void;
};

const actionMeta: Record<AIAnalysisResponse["action"], {
  label: string;
  tone: "success" | "warning" | "danger";
  description: string;
}> = {
  1: { label: "Buy", tone: "success", description: "Action score +1" },
  0: { label: "Hold", tone: "warning", description: "Action score 0" },
  [-1]: { label: "Sell", tone: "danger", description: "Action score -1" },
};

function getErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
    (error as Error | undefined)?.message ||
    "AI analysis is unavailable right now."
  );
}

export function AIAnalysisPanel({
  title = "AI Analysis",
  symbol,
  stockName,
  data,
  isLoading,
  isFetching,
  error,
  isAuthenticated = true,
  onRefresh,
}: AIAnalysisPanelProps) {
  const analysis = getResolvedAIAnalysis(data);
  const activeJob = isActiveAIAnalysisJob(data);
  const job = isAIAnalysisJob(data) ? data : null;
  const meta = analysis ? actionMeta[analysis.action] : null;

  const reasons = useMemo(() => {
    if (!analysis) return [];
    return [
      { key: "technical", label: "Technical", icon: CircleDot, text: analysis.reasons.technical },
      { key: "fundamental", label: "Fundamental", icon: FileText, text: analysis.reasons.fundamental },
      { key: "comprehensive", label: "Comprehensive", icon: Brain, text: analysis.reasons.comprehensive },
    ];
  }, [analysis]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-accent" />
            {title}
          </CardTitle>
          {(symbol || stockName) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[symbol, stockName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeJob && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {job?.status}
            </Badge>
          )}
          {analysis && meta && <Badge variant={meta.tone}>{meta.label}</Badge>}
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading || activeJob}>
              {isFetching || isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Analyze
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAuthenticated && (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            Sign in to run AI analysis.
          </div>
        )}

        {isAuthenticated && error && (
          <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{getErrorMessage(error)}</span>
          </div>
        )}

        {isAuthenticated && (isLoading || activeJob) && !analysis && !error && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            AI analysis is being prepared.
          </div>
        )}

        {analysis && meta && (
          <>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">Action</p>
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  <span className="text-xl font-semibold text-primary">{meta.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-primary">{analysis.summary.short_sentence}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary.long_sentence}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {reasons.map(({ key, label, icon: Icon, text }) => (
                <div key={key} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                    <Icon className="h-4 w-4 text-accent" />
                    {label}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>

            <div className="truncate text-xs text-muted-foreground">
              Request ID: <span className="font-mono">{analysis.request_id}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
