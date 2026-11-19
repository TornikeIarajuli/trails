import { AdminLayout } from "@/components/admin-layout";
import { GuidesList } from "./guides-list";

export default function GuidesPage() {
  return (
    <AdminLayout>
      <GuidesList />
    </AdminLayout>
  );
}
