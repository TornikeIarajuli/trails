export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  shop_name: string | null;
  external_url: string | null;
  sort_order: number;
  created_at: string;
}
