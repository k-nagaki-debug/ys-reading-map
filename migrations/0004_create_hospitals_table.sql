-- Create hospitals table for Y's READING
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  departments TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  image_url TEXT,
  has_ct BOOLEAN DEFAULT 0,
  has_mri BOOLEAN DEFAULT 0,
  has_pet BOOLEAN DEFAULT 0,
  has_remote_reading BOOLEAN DEFAULT 0,
  remote_reading_provider TEXT,
  has_onpremise BOOLEAN DEFAULT 0,
  has_cloud BOOLEAN DEFAULT 0,
  has_ichigo BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hospitals_created_at ON hospitals(created_at);
CREATE INDEX IF NOT EXISTS idx_hospitals_remote_reading ON hospitals(has_remote_reading);
