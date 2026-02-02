-- Migration: Guide Documents Table
-- Creates guide_documents table if it doesn't exist for storing guide certifications
-- Handles case where table exists without outfitter_id column

-- Step 1: Create table if it doesn't exist (using DO block for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guide_documents'
  ) THEN
    CREATE TABLE guide_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_name TEXT,
      file_size BIGINT,
      content_type TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Ensure unique storage paths
      UNIQUE(storage_path)
    );
  END IF;
END $$;

-- Step 2: Add outfitter_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guide_documents' 
    AND column_name = 'outfitter_id'
  ) THEN
    -- Add column as nullable first
    ALTER TABLE guide_documents 
    ADD COLUMN outfitter_id UUID REFERENCES outfitters(id) ON DELETE CASCADE;
    
    -- Populate outfitter_id from guides table for existing rows
    UPDATE guide_documents gd
    SET outfitter_id = g.outfitter_id
    FROM guides g
    WHERE gd.guide_id = g.id;
    
    -- Make it NOT NULL after populating
    ALTER TABLE guide_documents 
    ALTER COLUMN outfitter_id SET NOT NULL;
  END IF;
END $$;

-- Step 3: Create indexes (only after column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guide_documents'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_guide_documents_guide ON guide_documents(guide_id);
    CREATE INDEX IF NOT EXISTS idx_guide_documents_uploaded ON guide_documents(uploaded_at DESC);
    
    -- Create outfitter index only if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'guide_documents' 
      AND column_name = 'outfitter_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_guide_documents_outfitter ON guide_documents(outfitter_id);
    END IF;
  END IF;
END $$;

-- Step 4: Enable RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guide_documents'
  ) THEN
    ALTER TABLE guide_documents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Step 5: Create RLS policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guide_documents'
  ) THEN
    DROP POLICY IF EXISTS "Guides can view own documents" ON guide_documents;
    CREATE POLICY "Guides can view own documents"
      ON guide_documents FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM guides
          WHERE guides.id = guide_documents.guide_id
            AND guides.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Guides can insert own documents" ON guide_documents;
    CREATE POLICY "Guides can insert own documents"
      ON guide_documents FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM guides
          WHERE guides.id = guide_documents.guide_id
            AND guides.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Guides can delete own documents" ON guide_documents;
    CREATE POLICY "Guides can delete own documents"
      ON guide_documents FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM guides
          WHERE guides.id = guide_documents.guide_id
            AND guides.user_id = auth.uid()
        )
      );

    -- Admin policy only if outfitter_id column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'guide_documents' 
      AND column_name = 'outfitter_id'
    ) THEN
      DROP POLICY IF EXISTS "Admins can view outfitter guide documents" ON guide_documents;
      CREATE POLICY "Admins can view outfitter guide documents"
        ON guide_documents FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM outfitter_memberships
            WHERE outfitter_memberships.outfitter_id = guide_documents.outfitter_id
              AND outfitter_memberships.user_id = auth.uid()
              AND outfitter_memberships.status = 'active'
              AND outfitter_memberships.role IN ('owner', 'admin')
          )
        );
    END IF;
  END IF;
END $$;

-- Comment
COMMENT ON TABLE guide_documents IS 'Stores guide certification documents. Storage bucket: guide-documents';
