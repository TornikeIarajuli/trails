import { AdminLayout } from "@/components/admin-layout";
import { TrailEditor } from "./trail-editor";

export default function TrailEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminLayout>
      <TrailEditor paramsPromise={params} />
    </AdminLayout>
  );
}
