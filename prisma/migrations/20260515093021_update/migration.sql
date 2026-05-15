/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `auth_provider` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "auth_provider_userId_key" ON "auth_provider"("userId");
