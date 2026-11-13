"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getProductDetail, saveProduct } from "@/lib/actions";
import { call } from "@/lib/call";
import type { Product as SavedProduct } from "@/lib/types";
import { GEAR_CATEGORIES } from "@/lib/gear";
import { AdminError } from "@/components/admin-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

// The price is edited as text and converted to a number when saving.
type Product = Omit<SavedProduct, "price"> & { price: string };

export function ProductEditor({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();
  const isNew = id === "new";

  const [product, setProduct] = useState<Product>({
    id: "",
    name: "",
    description: null,
    image_url: null,
    price: "",
    shop_name: null,
    external_url: null,
    is_published: false,
    sort_order: 0,
    gear_tags: [],
  });
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [priceUnreadable, setPriceUnreadable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    call(getProductDetail(id)).then((res) => {
      if (cancelled) return;
      if (res.error !== null) setLoadError(res.error);
      else if (!res.product) setMissing(true);
      else setProduct({ ...res.product, price: res.product.price === null ? "" : String(res.product.price) });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(key: string) {
    setProduct((prev) => {
      const tags = prev.gear_tags ?? [];
      return { ...prev, gear_tags: tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key] };
    });
  }

  async function handleSave() {
    if (!product.name.trim()) {
      alert("The product name is required.");
      return;
    }
    const price = product.price.trim() === "" ? null : Number(product.price);
    if (priceUnreadable || (price !== null && !(price > 0))) {
      alert("The price must be a number greater than 0.");
      return;
    }

    setSaving(true);
    const res = await call(saveProduct(isNew ? null : id, {
      name: product.name,
      description: product.description || null,
      image_url: product.image_url || null,
      price,
      shop_name: product.shop_name || null,
      external_url: product.external_url || null,
      is_published: product.is_published,
      sort_order: product.sort_order,
      gear_tags: product.gear_tags ?? [],
    }));
    setSaving(false);

    if (res.error !== null) {
      alert(`Error: ${res.error}`);
    } else if (isNew) {
      router.push(`/shop/${res.id}`);
    } else {
      alert("Product saved!");
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (loadError) return <AdminError message={loadError} onRetry={() => window.location.reload()} />;
  if (missing) return <p>Product not found</p>;

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
                <Label>Price (GEL)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={product.price}
                  onChange={(e) => {
                    update("price", e.target.value);
                    // A number input reports "" for text it cannot parse; don't save that as "no price".
                    setPriceUnreadable(e.target.validity.badInput);
                  }}
                  placeholder="29.99"
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
          <CardHeader><CardTitle>Gear Tags</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Tick what this product is. The app links it from the matching item on each trail&rsquo;s
              &ldquo;What to bring&rdquo; list and uses it for the shop&rsquo;s category filters.
            </p>
            {GEAR_CATEGORIES.map((category) => (
              <div key={category.key}>
                <Label>{category.label}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {category.items.map((item) => {
                    const on = (product.gear_tags ?? []).includes(item.key);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(item.key)}
                        className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/80"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
