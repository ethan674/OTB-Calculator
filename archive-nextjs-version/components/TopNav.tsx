"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

interface TopNavProps {
  name: string;
  role: Role;
  seasonHeader: string;
}

const NAV_LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/input-grid", label: "Input Grid" },
  { href: "/otb-results", label: "OTB Results" },
  { href: "/submissions", label: "Submissions" },
  { href: "/admin/stores", label: "Admin", adminOnly: true },
];

export function TopNav({ name, role, seasonHeader }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">OTB Planner</span>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.filter((l) => !l.adminOnly || role === "admin").map((link) => {
              const active = pathname.startsWith(link.href.split("/").slice(0, 2).join("/"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">
            {name} · {role}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600">
        {seasonHeader}
      </div>
    </header>
  );
}
