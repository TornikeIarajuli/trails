import { Button } from "@/components/ui/button";

// Shown instead of a list or form when loading its data failed, so a failure is never
// mistaken for "there is nothing here".
export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
    >
      <p>
        <span className="font-medium text-destructive">Could not load this data.</span> {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
