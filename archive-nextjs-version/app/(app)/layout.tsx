import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlanningSeasons } from "@/lib/otb-engine";
import { TopNav } from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { current, planning1, planning2 } = getPlanningSeasons(new Date());
  const seasonHeader = `Current: ${current.label} (finalized) → Planning: ${planning1.label}, ${planning2.label}`;

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav name={session.name} role={session.role} seasonHeader={seasonHeader} />
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
