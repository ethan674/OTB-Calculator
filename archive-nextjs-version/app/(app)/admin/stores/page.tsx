import { prisma } from "@/lib/prisma";
import { AdminStoresClient } from "@/components/admin/AdminStoresClient";

export default async function AdminStoresPage() {
  const [stores, planners] = await Promise.all([
    prisma.store.findMany({ orderBy: { storeName: "asc" } }),
    prisma.user.findMany({ where: { role: "planner" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AdminStoresClient
      stores={stores.map((s) => ({
        id: s.id,
        storeCode: s.storeCode,
        storeName: s.storeName,
        brand: s.brand,
        channel: s.channel,
        market: s.market,
        currency: s.currency,
        active: s.active,
        ownerId: s.ownerId,
      }))}
      planners={planners.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
