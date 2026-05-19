import { Search, X } from "lucide-react";

interface EmptyStockStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function EmptyStockState({
  hasFilters,
  onClearFilters,
}: EmptyStockStateProps) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Search className="w-8 h-8 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold text-primary mb-1">
        No stocks found
      </h3>
      <p className="text-sm mb-4 max-w-xs mx-auto">
        Try adjusting your search or filters to find what you're looking for.
      </p>
      {hasFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <X className="w-4 h-4" />
          Clear filters
        </button>
      )}
    </div>
  );
}
