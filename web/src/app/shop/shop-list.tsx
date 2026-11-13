"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProducts, deleteProduct as deleteProductAction } from "@/lib/actions";
import { call } from "@/lib/call";
import type { ProductListItem } from "@/lib/types";
import { GEAR_LABELS } from "@/lib/gear";
import { AdminError } from "@/components/admin-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Search, Plus } from "lucide-react";

export function ShopList() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    call(getProducts()).then((res) => {
      if (cancelled) return;
      if (res.error !== null) setLoadError(res.error);
      else setProducts(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await call(deleteProductAction(id));
    if (res.error !== null) {
      alert(`Could not delete: ${res.error}`);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.shop_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Shop Products{loading || loadError ? "" : ` (${products.length})`}</h2>
        <Link href="/shop/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or shop..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : loadError ? (
        <AdminError message={loadError} onRetry={() => window.location.reload()} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Gear</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <Link
                        href={`/shop/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>{product.price != null ? `${product.price} ₾` : "-"}</TableCell>
                  <TableCell>{product.shop_name ?? "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(product.gear_tags ?? []).map((t) => GEAR_LABELS[t] ?? t).join(", ") || "-"}
                  </TableCell>
                  <TableCell>{product.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_published ? "default" : "secondary"}>
                      {product.is_published ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/shop/${product.id}`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id, product.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
