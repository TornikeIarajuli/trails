import { AdminLayout } from "@/components/admin-layout";
import { CommentsList } from "./comments-list";

export default function CommentsPage() {
  return (
    <AdminLayout>
      <CommentsList />
    </AdminLayout>
  );
}
