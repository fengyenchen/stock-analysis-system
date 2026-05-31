import { Brain, ChartNoAxesCombined, CircleAlert, Landmark, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getResolvedAIAnalysis, isActiveAIAnalysisJob } from "@/lib/aiAnalysis";
import { formatPercent } from "@/lib/format";
import {
  aiActionLabel,
  aiTone,
  countSignals,
  fundamentalHealth,
  isEtf,
  recommendationTone,
  type Tone,
} from "@/lib/signals";
import type {
  AIAnalysisResult,
  Stock,
  StockFundamental,
  StockQuote,
  StockRecommendation,
} from "@/types";

interface StockInsightCardsProps {
  stock?: Stock | null;
  recommendation?: StockRecommendation | null;
  fundamentals?: StockFundamental | null;
  quote?: StockQuote | null;
  aiAnalysis?: AIAnalysisResult | null;
  aiIsLoading?: boolean;
  isAuthenticated?: boolean;
}

function toneClasses(tone: Tone) {
  if (tone === "positive") return "bg-success/10 text-success border-success/20";
  if (tone === "caution") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function recommendationText(value?: "buy" | "hold" | "sell") {
  if (value === "buy") return "偏多追蹤";
  if (value === "sell") return "偏空保守";
  return "中性觀望";
}

function getTechnicalInsight(recommendation?: StockRecommendation | null) {
  if (!recommendation) {
    return {
      tone: "neutral" as Tone,
      label: "資料不足",
      summary: "目前沒有足夠的價格歷史可整理技術面解讀。",
      points: ["同步更多歷史價格後，系統會重新整理趨勢、動能與量能。"],
    };
  }

  const { buy: buySignals, sell: sellSignals } = countSignals(recommendation.indicator_signals);
  const tone = recommendationTone(recommendation.recommendation);

  return {
    tone,
    label: recommendationText(recommendation.recommendation),
    summary:
      buySignals > sellSignals
        ? "技術訊號偏向正面，但仍需留意是否已經接近短線高檔。"
        : sellSignals > buySignals
          ? "技術訊號偏弱，短線追價風險較高。"
          : "技術訊號分歧，現階段比較適合觀察趨勢是否延續。",
    points: [
      `正向訊號 ${buySignals} 個，負向訊號 ${sellSignals} 個。`,
      recommendation.reasons[0] ?? "目前以均線、動能與量能資料做綜合判斷。",
    ],
  };
}

function getFundamentalInsight(fundamentals?: StockFundamental | null) {
  if (!fundamentals) {
    return {
      tone: "neutral" as Tone,
      label: "資料不足",
      summary: "目前尚未取得完整基本面資料，先不要用估值或獲利能力做重判斷。",
      points: ["可先看價格趨勢；等基本面資料同步後，再補估值與財務品質解讀。"],
    };
  }

  const tone = fundamentalHealth(fundamentals)?.tone ?? "neutral";

  return {
    tone,
    label: tone === "positive" ? "品質較佳" : tone === "caution" ? "需再確認" : "大致中性",
    summary:
      tone === "positive"
        ? "基本面訊號相對完整，獲利、成長或估值至少有多項支持。"
        : tone === "caution"
          ? "基本面支持度不足，投資判斷不宜只看短線價格。"
          : "基本面訊號沒有明顯單邊結論，適合搭配產業與價格趨勢一起看。",
    points: [
      `本益比 ${fundamentals.pe_ratio ?? "—"}，營收成長 ${formatPercent(fundamentals.revenue_growth, { multiplier: 100 })}。`,
      `利潤率 ${formatPercent(fundamentals.profit_margins, { multiplier: 100 })}，ROE ${formatPercent(fundamentals.return_on_equity, { multiplier: 100 })}。`,
    ],
  };
}

function getEtfInsight(stock?: Stock | null) {
  const label = stock?.industry ? `${stock.industry} ETF` : "ETF";

  return {
    tone: "neutral" as Tone,
    label: "結構優先",
    summary: "ETF 不適合用單一公司的本益比或獲利率判斷，重點應放在追蹤標的、持股結構與交易成本。",
    points: [
      `目前分類為 ${label}，建議搭配成分股、費用率與折溢價一起看。`,
      "短線漲跌可參考技術面，但中長期仍要回到指數或主題本身。",
    ],
  };
}

function getInvestmentInsight(
  recommendation?: StockRecommendation | null,
  quote?: StockQuote | null
) {
  if (!recommendation) {
    return {
      tone: "neutral" as Tone,
      label: "等待資料",
      summary: "目前還不能形成完整投資建議，先避免過度解讀單一價格。",
      points: ["同步價格歷史與基本面後，再產生可讀的綜合建議。"],
    };
  }

  const tone = recommendationTone(recommendation.recommendation);
  const currentPrice = quote?.price ?? recommendation.indicators.close;
  const target = recommendation.support_resistance?.target_price;
  const stop = recommendation.support_resistance?.stop_loss;

  return {
    tone,
    label: recommendationText(recommendation.recommendation),
    summary:
      recommendation.recommendation === "buy"
        ? "綜合訊號偏正面，可列入追蹤，但仍需設定風險界線。"
        : recommendation.recommendation === "sell"
          ? "綜合訊號偏保守，除非資料改善，否則不適合積極追價。"
          : "目前沒有強烈方向，較適合等待更明確的價格或基本面訊號。",
    points: [
      `目前價格 ${currentPrice ?? "—"}，信心分數 ${recommendation.confidence}%。`,
      `目標價 ${target ?? "—"}，停損參考 ${stop ?? "—"}。`,
    ],
  };
}

export function StockInsightCards({
  stock,
  recommendation,
  fundamentals,
  quote,
  aiAnalysis,
  aiIsLoading,
  isAuthenticated = false,
}: StockInsightCardsProps) {
  const isETF = stock ? isEtf(stock.symbol, stock) : false;
  const fundamentalTitle = isETF ? "ETF 摘要" : "基本面";

  // Resolve PR #17 AI analysis result (handles both direct response and async job).
  const ai = getResolvedAIAnalysis(aiAnalysis);
  const aiActive = isActiveAIAnalysisJob(aiAnalysis);
  const aiPending = isAuthenticated && (Boolean(aiIsLoading) || aiActive) && !ai;

  const headerLabel = ai
    ? "AI 模型分析"
    : aiPending
      ? "AI 分析產生中…"
      : isETF
        ? "ETF 規則摘要"
        : "本地規則摘要";

  // Base cards are always built from local rules so the page works without AI / sign-in.
  const technical = getTechnicalInsight(recommendation);
  const fundamental = isETF ? getEtfInsight(stock) : getFundamentalInsight(fundamentals);
  const investment = getInvestmentInsight(recommendation, quote);

  // When AI results are available, surface them as the headline of each card.
  const cards = [
    {
      title: "技術面",
      icon: ChartNoAxesCombined,
      ...technical,
      ...(ai ? { summary: ai.reasons.technical } : {}),
    },
    {
      title: fundamentalTitle,
      icon: Landmark,
      ...fundamental,
      ...(ai ? { summary: ai.reasons.fundamental } : {}),
    },
    {
      title: "綜合建議",
      icon: Sparkles,
      ...investment,
      ...(ai
        ? {
            tone: aiTone(ai.action),
            label: aiActionLabel(ai.action),
            summary: ai.summary.short_sentence,
            points: [ai.summary.long_sentence, ai.reasons.comprehensive],
          }
        : {}),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-primary">AI 解讀</h2>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {aiPending && <Loader2 className="h-3 w-3 animate-spin" />}
          {headerLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="rounded-xl">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-accent/10 p-2">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className={toneClasses(card.tone)}>
                    {card.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-primary">{card.summary}</p>
                <div className="space-y-2">
                  {card.points.map((point) => (
                    <div key={point} className="flex gap-2 text-xs text-muted-foreground">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="leading-5">{point}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
