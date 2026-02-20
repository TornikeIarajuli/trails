"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getProductDetail, saveProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string | null;
  shop_name: string | null;
  external_url: string | null;
  is_published: boolean;
  sort_order: number;
}

export function ProductEditor({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();
  const isNew = id === "new";

  const [product, setProduct] = useState<Product>({
    id: "",
    name: "",
    description: null,
    image_url: null,
    price: null,
    shop_name: null,
    external_url: null,
    is_published: false,
    sort_order: 0,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getProductDetail(id).then((data) => {
      if (data) setProduct(data as Product);
    }).finally(() => setLoading(false));
  }, [id, isNew]);

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name: product.name,
      description: product.description || null,
      image_url: product.image_url || null,
      price: product.price || null,
      shop_name: product.shop_name || null,
      external_url: product.external_url || null,
      is_published: product.is_published,
      sort_order: product.sort_order,
    };

    const { data, error } = await saveProduct(isNew ? null : id, payload);
    if (error) {
      alert(`Error: ${error}`);
    } else if (isNew && data) {
      router.push(`/shop/${(data as { id: string }).id}`);
    } else {
      alert("Product saved!");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/shop">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h2 className="text-2xl font-bold flex-1">
          {isNew ? "New Product" : product.name}
        </h2>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label>Product Name</Label>
              <Input value={product.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={product.description ?? ""}
                onChange={(e) => update("description", e.target.value || null)}
                placeholder="Brief description of the product..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Shop Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price</Label>
                <Input
                  value={product.price ?? ""}
                  onChange={(e) => update("price", e.target.value || null)}
                  placeholder="$29.99"
                />
              </div>
              <div>
                <Label>Shop Name</Label>
                <Input
                  value={product.shop_name ?? ""}
                  onChange={(e) => update("shop_name", e.target.value || null)}
                  placeholder="Amazon, Decathlon..."
                />
              </div>
            </div>
            <div>
              <Label>External URL (buy link)</Label>
              <Input
                value={product.external_url ?? ""}
                onChange={(e) => update("external_url", e.target.value || null)}
                placeholder="https://shop.example.com/product"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Image</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label>Image URL</Label>
              <Input
                value={product.image_url ?? ""}
                onChange={(e) => update("image_url", e.target.value || null)}
                placeholder="https://..."
              />
            </div>
            {product.image_url && (
              <img
                src={product.image_url}
                alt="Product"
                className="rounded-lg max-h-48 object-cover"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={product.sort_order}
                  onChange={(e) => update("sort_order", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <Label>Published</Label>
                <button
                  onClick={() => update("is_published", !product.is_published)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    product.is_published ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: product.is_published ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
