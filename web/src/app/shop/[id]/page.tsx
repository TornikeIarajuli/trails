import { AdminLayout } from "@/components/admin-layout";
import { ProductEditor } from "./product-editor";

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminLayout>
      <ProductEditor paramsPromise={params} />
    </AdminLayout>
  );
}
