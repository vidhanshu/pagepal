-- Enable pgvector (required for vector(768) columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN "embedding" vector(768);
