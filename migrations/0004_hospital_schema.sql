-- Convert facilities table to hospitals table with medical-specific fields
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Step 1: Create new hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  departments TEXT,  -- 診療科目（カンマ区切り）
  latitude REAL,
  longitude REAL,
  address TEXT,
  phone TEXT,
  website TEXT,
  image_url TEXT,
  business_hours TEXT,  -- 診療時間
  closed_days TEXT,     -- 休診日
  parking TEXT,         -- 駐車場情報
  emergency BOOLEAN DEFAULT 0,  -- 救急対応
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from facilities (if exists)
INSERT INTO hospitals (id, name, description, departments, latitude, longitude, address, phone, website, image_url, created_at, updated_at)
SELECT id, name, description, category, latitude, longitude, address, phone, website, image_url, created_at, updated_at
FROM facilities;

-- Step 3: Drop old facilities table
DROP TABLE IF EXISTS facilities;

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hospitals_departments ON hospitals(departments);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hospitals_created_at ON hospitals(created_at);
CREATE INDEX IF NOT EXISTS idx_hospitals_emergency ON hospitals(emergency);
