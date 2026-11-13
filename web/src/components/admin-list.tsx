import { AdminError } from "@/components/admin-error";
import { TableCell, TableRow } from "@/components/ui/table";

// Wraps a list's table: an error state when loading failed, "Loading..." before the first
// page arrives, and a dimmed table while another page is on its way.
export function ListFrame({
  error,
  loading,
  ready,
  onRetry,
  children,
}: {
  error: string | null;
  loading: boolean;
  ready: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (error) return <AdminError message={error} onRetry={onRetry} />;
  if (!ready) return <p className="text-muted-foreground">Loading...</p>;
  return <div className={`border rounded-lg ${loading ? "opacity-60" : ""}`}>{children}</div>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
        {children}
      </TableCell>
    </TableRow>
  );
}
