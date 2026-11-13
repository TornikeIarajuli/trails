import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/types";

export function AdminPagination({
  page,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1 && page === 1) return null;

  const first = Math.min((page - 1) * PAGE_SIZE + 1, total);
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>{total > 0 && first <= last ? `Showing ${first}–${last} of ${total}` : ""}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
