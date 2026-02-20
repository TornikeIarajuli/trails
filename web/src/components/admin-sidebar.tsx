"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mountain,
  Users,
  Trophy,
  Star,
  AlertTriangle,
  Bookmark,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trails", label: "Trails", icon: Mountain },
  { href: "/users", label: "Users", icon: Users },
  { href: "/completions", label: "Completions", icon: Trophy },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/conditions", label: "Conditions", icon: AlertTriangle },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">Mikiri Trails</h1>
        <p className="text-xs text-muted-foreground">Admin Panel</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
