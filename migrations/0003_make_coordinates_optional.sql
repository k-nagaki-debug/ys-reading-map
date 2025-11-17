-- Make latitude and longitude optional (allow NULL)
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Step 1: Create new table with optional coordinates
CREATE TABLE facilities_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  phone TEXT,
  website TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from old table
INSERT INTO facilities_new (id, name, description, category, latitude, longitude, address, phone, website, image_url, created_at, updated_at)
SELECT id, name, description, category, latitude, longitude, address, phone, website, image_url, created_at, updated_at
FROM facilities;

-- Step 3: Drop old table
DROP TABLE facilities;

-- Step 4: Rename new table
ALTER TABLE facilities_new RENAME TO facilities;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_facilities_category ON facilities(category);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_facilities_created_at ON facilities(created_at);
