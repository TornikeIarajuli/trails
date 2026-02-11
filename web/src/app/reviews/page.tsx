import { AdminLayout } from "@/components/admin-layout";
import { ReviewsList } from "./reviews-list";

export default function ReviewsPage() {
  return (
    <AdminLayout>
      <ReviewsList />
    </AdminLayout>
  );
}
