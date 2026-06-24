-- Partial unique indexes: slug reuse after soft-delete
CREATE UNIQUE INDEX IF NOT EXISTS service_slug_active ON services(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS case_study_slug_active ON case_studies(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS post_slug_active ON posts(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS page_slug_active ON pages(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS glossary_slug_active ON glossary_terms(slug) WHERE deleted_at IS NULL;

-- Lead score constraint
ALTER TABLE leads ADD CONSTRAINT lead_score_range CHECK (score >= 0 AND score <= 100);

-- pgvector HNSW index for similarity search
CREATE INDEX IF NOT EXISTS content_embedding_hnsw ON content_embeddings USING hnsw (embedding vector_cosine_ops);
