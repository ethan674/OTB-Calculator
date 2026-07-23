import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";

const TABS = [
  { href: "/admin/stores", label: "Stores" },
  { href: "/admin/fx-rates", label: "FX Rates" },
  { href: "/admin/locks", label: "Locks" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1 w-fit">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
