import { prisma } from "@/lib/prisma";
import { currentPlanningContext } from "@/lib/planning";
import { AdminLocksClient } from "@/components/admin/AdminLocksClient";

export default async function AdminLocksPage() {
  const { current, planning1, planning2 } = currentPlanningContext();
  const locks = await prisma.seasonLock.findMany({
    where: { seasonLabel: { in: [planning1.label, planning2.label] } },
  });
  const lockMap: Record<string, { locked: boolean; lockedAt: string | null }> = {
    [planning1.label]: { locked: false, lockedAt: null },
    [planning2.label]: { locked: false, lockedAt: null },
  };
  for (const l of locks) {
    lockMap[l.seasonLabel] = { locked: l.locked, lockedAt: l.lockedAt?.toISOString() ?? null };
  }

  return (
    <AdminLocksClient
      currentLabel={current.label}
      seasons={[
        { label: planning1.label, ...lockMap[planning1.label] },
        { label: planning2.label, ...lockMap[planning2.label] },
      ]}
    />
  );
}
