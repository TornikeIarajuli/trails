"use client";

import { useState } from "react";
import { getConditions, deleteCondition, toggleConditionActive } from "@/lib/actions";
import { call } from "@/lib/call";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
};

export function ConditionsList() {
  const [page, setPage] = useState(1);
  const { rows, total, ready, error, loading, reload } = usePagedList(getConditions, { page });

  async function remove(id: string) {
    if (!confirm("Delete this condition report?")) return;
    const res = await call(deleteCondition(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await call(toggleConditionActive(id, current));
    if (res.error !== null) alert(`Could not update: ${res.error}`);
    reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Trail Conditions{ready ? ` (${total})` : ""}</h2>
      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trail</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.trails?.name_en ?? "-"}</TableCell>
                <TableCell className="text-sm">{c.condition_type.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[c.severity] ?? ""}`}>
                    {c.severity}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs text-sm truncate" title={c.description ?? undefined}>{c.description ?? "-"}</TableCell>
                <TableCell className="text-sm">{c.profiles?.username ?? "-"}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(c.id, c.is_active)}>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-sm">{new Date(c.reported_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8}>No condition reports yet.</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
