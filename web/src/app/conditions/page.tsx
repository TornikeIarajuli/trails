import { AdminLayout } from "@/components/admin-layout";
import { ConditionsList } from "./conditions-list";

export default function ConditionsPage() {
  return (
    <AdminLayout>
      <ConditionsList />
    </AdminLayout>
  );
}
