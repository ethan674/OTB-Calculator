import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleStores, currentPlanningContext } from "@/lib/planning";
import { SubmissionsClient, type SubmissionSummary } from "@/components/submissions/SubmissionsClient";

export default async function SubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { current } = currentPlanningContext();
  const stores = await getVisibleStores(session);
  const storeIds = stores.map((s) => s.id);

  const [submissions, planningInputs] = await Promise.all([
    prisma.submission.findMany({
      where: { storeId: { in: storeIds }, cycleLabel: current.label },
      include: { user: true, store: true },
      orderBy: [{ storeId: "asc" }, { version: "desc" }],
    }),
    prisma.planningInput.findMany({
      where: { storeId: { in: storeIds }, cycleLabel: current.label },
    }),
  ]);

  const draftUpdatedByStore = new Map(planningInputs.map((p) => [p.storeId, p.updatedAt.toISOString()]));

  const submissionSummaries: SubmissionSummary[] = submissions.map((s) => ({
    id: s.id,
    storeId: s.storeId,
    storeCode: s.store.storeCode,
    storeName: s.store.storeName,
    brand: s.store.brand,
    channel: s.store.channel,
    market: s.store.market,
    version: s.version,
    submittedBy: s.user.name,
    submittedAt: s.createdAt.toISOString(),
    comment: s.comment,
    outputs: JSON.parse(s.outputsJson),
    planningSeason1: s.planningSeason1,
    planningSeason2: s.planningSeason2,
  }));

  const storeSummaries = stores.map((s) => ({
    storeId: s.id,
    storeCode: s.storeCode,
    storeName: s.storeName,
    brand: s.brand,
    channel: s.channel,
    market: s.market,
    draftUpdatedAt: draftUpdatedByStore.get(s.id) ?? null,
  }));

  return (
    <SubmissionsClient
      role={session.role}
      currentLabel={current.label}
      stores={storeSummaries}
      submissions={submissionSummaries}
    />
  );
}
