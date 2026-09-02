-- CreateTable
CREATE TABLE "MarketData" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketDataCoverage" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketDataCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketData_date_idx" ON "MarketData"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketData_symbol_date_key" ON "MarketData"("symbol", "date");

-- CreateIndex
CREATE INDEX "MarketDataCoverage_symbol_startDate_endDate_idx" ON "MarketDataCoverage"("symbol", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketDataCoverage_symbol_startDate_endDate_key" ON "MarketDataCoverage"("symbol", "startDate", "endDate");
