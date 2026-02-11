import { AdminSidebar } from "@/components/admin-sidebar";
import { DashboardContent } from "./dashboard-content";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <DashboardContent />
      </main>
    </div>
  );
}
