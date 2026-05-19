import { ShieldAlert } from "lucide-react";

export function FooterDisclaimer() {
  return (
    <div className="border-t border-border bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-primary">免責聲明：</strong>
            以上AI推薦信號僅供參考，不構成任何投資建議。過往績效不保證未來收益。投資有風險，入市需謹慎。請根據自身風險承受能力做出獨立判斷，必要時請諮詢專業投資顧問。
          </p>
        </div>
      </div>
    </div>
  );
}
