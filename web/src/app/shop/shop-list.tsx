"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProducts, deleteProduct as deleteProductAction } from "@/lib/actions";
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

interface Product {
  id: string;
  name: string;
  price: string | null;
  shop_name: string | null;
  image_url: string | null;
  is_published: boolean;
  sort_order: number;
}

export function ShopList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getProducts().then((d) => setProducts(d as Product[])).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteProductAction(id);
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
        <h2 className="text-2xl font-bold">Shop Products ({products.length})</h2>
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
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Shop</TableHead>
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
                  <TableCell>{product.price ?? "-"}</TableCell>
                  <TableCell>{product.shop_name ?? "-"}</TableCell>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
