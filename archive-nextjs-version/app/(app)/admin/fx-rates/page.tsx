import { prisma } from "@/lib/prisma";
import { AdminFxRatesClient } from "@/components/admin/AdminFxRatesClient";

export default async function AdminFxRatesPage() {
  const [rates, stores] = await Promise.all([
    prisma.fxRate.findMany({ orderBy: { currency: "asc" } }),
    prisma.store.findMany({ where: { active: true }, select: { currency: true } }),
  ]);

  const knownCurrencies = new Set(rates.map((r) => r.currency));
  const missingCurrencies = Array.from(new Set(stores.map((s) => s.currency))).filter((c) => !knownCurrencies.has(c));

  return (
    <AdminFxRatesClient
      rates={rates.map((r) => ({ currency: r.currency, rateToUsd: r.rateToUsd, asOfDate: r.asOfDate.toISOString() }))}
      missingCurrencies={missingCurrencies}
    />
  );
}
