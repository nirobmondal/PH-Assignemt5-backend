/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `needPasswordChange` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_isDeleted_idx";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "deletedAt",
DROP COLUMN "isDeleted",
DROP COLUMN "needPasswordChange";
