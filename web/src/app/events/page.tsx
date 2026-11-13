import { AdminLayout } from "@/components/admin-layout";
import { EventsList } from "./events-list";

export default function EventsPage() {
  return (
    <AdminLayout>
      <EventsList />
    </AdminLayout>
  );
}
