-- AlterTable
ALTER TABLE "files" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "file_versions" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_versions_created_by_id_idx" ON "file_versions"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_file_id_version_key" ON "file_versions"("file_id", "version");

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everything below is written by hand, because Prisma's schema language cannot
-- say it.

-- Versions are counted from one and never reused, so the pair (file, version)
-- names one set of bytes for good.
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_number_positive" CHECK ("version" > 0);
ALTER TABLE "files" ADD CONSTRAINT "files_version_positive" CHECK ("version" > 0);

-- Every file already in a room is its own first version. Its bytes have not
-- moved: the key for version one is the key the file has always had.
INSERT INTO "file_versions" ("id", "file_id", "version", "storage_key", "size_bytes", "mime_type", "created_by_id", "created_at")
SELECT gen_random_uuid(), f."id", 1, f."storage_key", f."size_bytes", f."mime_type", r."owner_id", f."created_at"
FROM "files" f
JOIN "data_rooms" r ON r."id" = f."data_room_id";

-- Search is "contains", which no btree can answer. A trigram index can, and
-- without one every keystroke reads every file in the database.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX "files_name_trgm_idx" ON "files" USING gin ("name" extensions.gin_trgm_ops);
