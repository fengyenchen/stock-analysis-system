import { PlusCircle, MinusCircle, BellRing, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QuickActionsProps {
  onBuy?: () => void;
  onSell?: () => void;
  onAlert?: () => void;
  onWatchlist?: () => void;
}

export function QuickActions({
  onBuy,
  onSell,
  onAlert,
  onWatchlist,
}: QuickActionsProps) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 animate-fade-in-up delay-200">
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onBuy}
          className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl bg-success hover:bg-emerald-600 text-white transition-all hover:-translate-y-0.5 shadow-lg shadow-success/25"
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-sm font-semibold">買入</span>
        </Button>
        <Button
          onClick={onSell}
          variant="outline"
          className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl bg-muted hover:bg-muted/80 text-primary transition-all hover:-translate-y-0.5"
        >
          <MinusCircle className="w-6 h-6" />
          <span className="text-sm font-semibold">賣出</span>
        </Button>
        <Button
          onClick={onAlert}
          variant="outline"
          className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl bg-muted hover:bg-muted/80 text-primary transition-all hover:-translate-y-0.5"
        >
          <BellRing className="w-6 h-6" />
          <span className="text-sm font-semibold">設定警報</span>
        </Button>
        <Button
          onClick={onWatchlist}
          variant="outline"
          className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl bg-muted hover:bg-muted/80 text-primary transition-all hover:-translate-y-0.5"
        >
          <Star className="w-6 h-6" />
          <span className="text-sm font-semibold">加自選</span>
        </Button>
      </div>
    </div>
  );
}
