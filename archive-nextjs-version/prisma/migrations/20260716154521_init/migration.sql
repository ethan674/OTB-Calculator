-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeCode" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanningInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleLabel" TEXT NOT NULL,
    "planningSeason1" TEXT NOT NULL,
    "planningSeason2" TEXT NOT NULL,
    "currentOnHandInventory" REAL NOT NULL DEFAULT 0,
    "currentRemainingReceipts" REAL NOT NULL DEFAULT 0,
    "currentDiscountPct" REAL NOT NULL DEFAULT 0,
    "monthlyForecastJson" TEXT NOT NULL DEFAULT '{}',
    "s1SellThroughPct" REAL NOT NULL DEFAULT 0,
    "s1DiscountPct" REAL NOT NULL DEFAULT 0,
    "s1OnOrder" REAL NOT NULL DEFAULT 0,
    "s1ManualSosOverride" REAL,
    "s2SellThroughPct" REAL NOT NULL DEFAULT 0,
    "s2DiscountPct" REAL NOT NULL DEFAULT 0,
    "s2OnOrder" REAL NOT NULL DEFAULT 0,
    "s2ManualSosOverride" REAL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningInput_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanningInput_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleLabel" TEXT NOT NULL,
    "planningSeason1" TEXT NOT NULL,
    "planningSeason2" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "comment" TEXT,
    "inputsJson" TEXT NOT NULL,
    "fxRatesJson" TEXT NOT NULL,
    "outputsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currency" TEXT NOT NULL,
    "rateToUsd" REAL NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonLabel" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Store_storeCode_key" ON "Store"("storeCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningInput_storeId_cycleLabel_key" ON "PlanningInput"("storeId", "cycleLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_storeId_cycleLabel_version_key" ON "Submission"("storeId", "cycleLabel", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_currency_key" ON "FxRate"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonLock_seasonLabel_key" ON "SeasonLock"("seasonLabel");
