import { AdminLayout } from "@/components/admin-layout";
import { PostsList } from "./posts-list";

export default function PostsPage() {
  return (
    <AdminLayout>
      <PostsList />
    </AdminLayout>
  );
}
