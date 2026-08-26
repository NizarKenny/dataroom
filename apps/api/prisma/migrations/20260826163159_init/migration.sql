-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('data_room', 'folder', 'file');

-- CreateEnum
CREATE TYPE "share_mode" AS ENUM ('public_link', 'user');

-- CreateEnum
CREATE TYPE "share_role" AS ENUM ('viewer');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_rooms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "resource_type" "resource_type" NOT NULL,
    "resource_id" UUID NOT NULL,
    "resource_path" TEXT,
    "mode" "share_mode" NOT NULL,
    "role" "share_role" NOT NULL DEFAULT 'viewer',
    "token" TEXT,
    "grantee_user_id" UUID,
    "grantee_email" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "data_rooms_owner_id_name_idx" ON "data_rooms"("owner_id", "name");

-- CreateIndex
CREATE INDEX "folders_data_room_id_idx" ON "folders"("data_room_id");

-- CreateIndex
CREATE INDEX "folders_path_idx" ON "folders"("path" text_pattern_ops);

-- CreateIndex
CREATE UNIQUE INDEX "folders_parent_id_name_key" ON "folders"("parent_id", "name");

-- CreateIndex
CREATE INDEX "files_data_room_id_idx" ON "files"("data_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_folder_id_name_key" ON "files"("folder_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_key" ON "shares"("token");

-- CreateIndex
CREATE INDEX "shares_data_room_id_idx" ON "shares"("data_room_id");

-- CreateIndex
CREATE INDEX "shares_created_by_id_idx" ON "shares"("created_by_id");

-- AddForeignKey
ALTER TABLE "data_rooms" ADD CONSTRAINT "data_rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_grantee_user_id_fkey" FOREIGN KEY ("grantee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Everything below is hand-written: Prisma models neither partial indexes nor
-- check constraints, and both carry weight here.

-- One root folder per data room. The unique on (parent_id, name) does not cover
-- it, because Postgres treats NULLs as distinct and every root has a null parent.
CREATE UNIQUE INDEX "folders_one_root_per_room" ON "folders"("data_room_id")
  WHERE "parent_id" IS NULL;

-- Access asks whether any ancestor of a node is shared and whether that share is
-- still alive. Revoked rows never answer yes, so they stay out of the indexes.
CREATE INDEX "shares_live_resource_path_idx" ON "shares"("resource_path")
  WHERE "revoked_at" IS NULL;
CREATE INDEX "shares_live_resource_id_idx" ON "shares"("resource_id")
  WHERE "revoked_at" IS NULL;
CREATE INDEX "shares_live_grantee_idx" ON "shares"("grantee_user_id")
  WHERE "revoked_at" IS NULL;

-- A room or folder share carries the path it was granted at; a file has no
-- subtree, so a file share has no path.
ALTER TABLE "shares" ADD CONSTRAINT "shares_path_matches_type"
  CHECK (("resource_type" = 'file') = ("resource_path" IS NULL));

-- A public link is identified by its token, a permissioned share by its
-- recipient. Neither shape may borrow the other's columns.
ALTER TABLE "shares" ADD CONSTRAINT "shares_mode_shape" CHECK (
  CASE "mode"
    WHEN 'public_link' THEN "token" IS NOT NULL
      AND "grantee_user_id" IS NULL AND "grantee_email" IS NULL
    WHEN 'user' THEN "token" IS NULL
      AND ("grantee_user_id" IS NOT NULL OR "grantee_email" IS NOT NULL)
    -- A CASE with no match yields NULL, and a NULL check passes. Fail closed so
    -- that adding a third mode without revisiting this constraint breaks loudly.
    ELSE false
  END
);

-- An invitation is matched to an account by email, so only one casing is stored.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase"
  CHECK ("email" = lower("email"));
ALTER TABLE "shares" ADD CONSTRAINT "shares_grantee_email_lowercase"
  CHECK ("grantee_email" IS NULL OR "grantee_email" = lower("grantee_email"));
