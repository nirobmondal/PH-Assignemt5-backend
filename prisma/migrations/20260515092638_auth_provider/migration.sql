/*
  Warnings:

  - You are about to drop the column `googleId` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_googleId_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "googleId";

-- CreateTable
CREATE TABLE "auth_provider" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "auth_provider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_provider_providerId_key" ON "auth_provider"("providerId");

-- AddForeignKey
ALTER TABLE "auth_provider" ADD CONSTRAINT "auth_provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
