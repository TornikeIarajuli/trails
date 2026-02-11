import { AdminLayout } from "@/components/admin-layout";
import { UsersList } from "./users-list";

export default function UsersPage() {
  return (
    <AdminLayout>
      <UsersList />
    </AdminLayout>
  );
}
