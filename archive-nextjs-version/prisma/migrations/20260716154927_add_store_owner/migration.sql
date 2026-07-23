-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeCode" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("active", "brand", "channel", "createdAt", "currency", "id", "market", "storeCode", "storeName", "updatedAt") SELECT "active", "brand", "channel", "createdAt", "currency", "id", "market", "storeCode", "storeName", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_storeCode_key" ON "Store"("storeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
