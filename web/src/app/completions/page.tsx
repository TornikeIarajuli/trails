import { AdminLayout } from "@/components/admin-layout";
import { CompletionsList } from "./completions-list";

export default function CompletionsPage() {
  return (
    <AdminLayout>
      <CompletionsList />
    </AdminLayout>
  );
}
