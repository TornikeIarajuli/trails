import { AdminLayout } from "@/components/admin-layout";
import { PhotosList } from "./photos-list";

export default function PhotosPage() {
  return (
    <AdminLayout>
      <PhotosList />
    </AdminLayout>
  );
}
