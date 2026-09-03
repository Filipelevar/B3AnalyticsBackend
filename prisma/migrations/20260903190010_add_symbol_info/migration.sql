-- CreateTable
CREATE TABLE "SymbolInfo" (
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymbolInfo_pkey" PRIMARY KEY ("symbol")
);
