import { AdminLayout } from "@/components/admin-layout";
import { TrailReviewScreen } from "./trail-review";

export default function TrailReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminLayout>
      <TrailReviewScreen paramsPromise={params} />
    </AdminLayout>
  );
}
