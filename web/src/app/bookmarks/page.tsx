import { AdminLayout } from "@/components/admin-layout";
import { BookmarksList } from "./bookmarks-list";

export default function BookmarksPage() {
  return (
    <AdminLayout>
      <BookmarksList />
    </AdminLayout>
  );
}
