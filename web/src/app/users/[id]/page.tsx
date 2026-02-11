import { AdminLayout } from "@/components/admin-layout";
import { UserDetail } from "./user-detail";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminLayout>
      <UserDetail paramsPromise={params} />
    </AdminLayout>
  );
}
