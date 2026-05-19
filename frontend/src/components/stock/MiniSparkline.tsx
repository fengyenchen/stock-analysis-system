interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 32,
  className,
}: MiniSparklineProps) {
  if (!data || data.length < 2) {
    return <div className={`h-8 w-20 bg-muted rounded ${className || ""}`} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const last = data[data.length - 1];
  const first = data[0];
  const color = last >= first ? "#22c55e" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      className={`opacity-80 ${className || ""}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}
