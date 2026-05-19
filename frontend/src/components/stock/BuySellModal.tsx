import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTransaction } from "@/api/portfolio";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BuySellModalProps {
  symbol: string;
  type: "buy" | "sell";
  currentPrice?: string;
  onClose: () => void;
}

export function BuySellModal({ symbol, type, currentPrice, onClose }: BuySellModalProps) {
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState(currentPrice || "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction({
        symbol,
        transaction_type: type,
        shares,
        price,
      }),
    onSuccess: () => {
      toast.success(`${type === "buy" ? "買入" : "賣出"} 交易已記錄`);
      queryClient.invalidateQueries({ queryKey: ["portfolio-positions"] });
      onClose();
    },
    onError: () => {
      toast.error("交易記錄失敗");
    },
  });

  const total = shares && price ? (parseFloat(shares) * parseFloat(price)).toFixed(2) : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold">
            {type === "buy" ? "買入" : "賣出"} {symbol}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">成交價</label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="輸入價格"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">股數</label>
            <Input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="輸入股數"
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">總金額</span>
            <span className="font-semibold">{total} TWD</span>
          </div>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!shares || !price || mutation.isPending}
            className={`w-full ${
              type === "buy"
                ? "bg-success hover:bg-emerald-600"
                : "bg-danger hover:bg-red-600"
            }`}
          >
            {mutation.isPending ? "處理中..." : type === "buy" ? "確認買入" : "確認賣出"}
          </Button>
        </div>
      </div>
    </div>
  );
}
