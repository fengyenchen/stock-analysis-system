import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import type { StockPrice } from "@/types";
import type { PriceChartProps } from "@/types/stock";

function computeMA(data: StockPrice[], period: number): LineData<Time>[] {
  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const result: LineData<Time>[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += parseFloat(sorted[j].close_price);
    }
    result.push({
      time: sorted[i].date as Time,
      value: parseFloat((sum / period).toFixed(2)),
    });
  }
  return result;
}

export function PriceChart({ data, isLoading, isDark }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [showMA5, setShowMA5] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(false);

  const textColor = isDark ? "#f8fafc" : "#0f172a";
  const gridColor = isDark
    ? "rgba(51,65,85,0.4)"
    : "rgba(226,232,240,0.4)";
  const borderColor = isDark ? "#334155" : "#e2e8f0";
  const upColor = "#ef4444";
  const downColor = "#22c55e";

  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [data]);

  const candleData: CandlestickData<Time>[] = useMemo(() => {
    return sortedData.map((p) => ({
      time: p.date as Time,
      open: parseFloat(p.open_price),
      high: parseFloat(p.high_price),
      low: parseFloat(p.low_price),
      close: parseFloat(p.close_price),
    }));
  }, [sortedData]);

  const volumeData: HistogramData<Time>[] = useMemo(() => {
    return sortedData.map((p, i) => {
      const prev = i > 0 ? sortedData[i - 1] : null;
      const close = parseFloat(p.close_price);
      const prevClose = prev ? parseFloat(prev.close_price) : close;
      return {
        time: p.date as Time,
        value: p.volume,
        color:
          close >= prevClose
            ? "rgba(239, 68, 68, 0.45)"
            : "rgba(34, 197, 94, 0.45)",
      };
    });
  }, [sortedData]);

  const ma5Data = useMemo(() => computeMA(sortedData, 5), [sortedData]);
  const ma20Data = useMemo(() => computeMA(sortedData, 20), [sortedData]);
  const ma60Data = useMemo(() => computeMA(sortedData, 60), [sortedData]);

  useEffect(() => {
    if (!containerRef.current || sortedData.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        timeVisible: false,
      },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceScaleId: "right",
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.25 },
    });
    candleSeries.setData(candleData);

    const ma5Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceScaleId: "right",
      visible: showMA5,
    });
    ma5Series.setData(ma5Data);

    const ma20Series = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      lineStyle: 2,
      priceScaleId: "right",
      visible: showMA20,
    });
    ma20Series.setData(ma20Data);

    const ma60Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      priceScaleId: "right",
      visible: showMA60,
    });
    ma60Series.setData(ma60Data);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeSeries.setData(volumeData);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candleData, volumeData, ma5Data, ma20Data, ma60Data, textColor, gridColor, borderColor, showMA5, showMA20, showMA60]);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm animate-fade-in-up delay-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-3">
        <h3 className="font-bold text-lg">價格走勢</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showMA5}
              onChange={(e) => setShowMA5(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-blue-500"
            />
            <span className="text-xs text-muted-foreground">MA5</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showMA20}
              onChange={(e) => setShowMA20(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-orange-500"
            />
            <span className="text-xs text-muted-foreground">MA20</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showMA60}
              onChange={(e) => setShowMA60(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-purple-500"
            />
            <span className="text-xs text-muted-foreground">MA60</span>
          </label>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No historical data available.</p>
          </div>
        ) : (
          <div ref={containerRef} className="w-full" style={{ height: 520 }} />
        )}
      </div>
    </div>
  );
}
