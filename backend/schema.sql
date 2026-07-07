CREATE TABLE IF NOT EXISTS voice_packs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  file_path VARCHAR(500) NOT NULL,
  duration INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_pack_messages (
  id VARCHAR(36) PRIMARY KEY,
  sender_id VARCHAR(255) NOT NULL,
  receiver_id VARCHAR(255) NOT NULL,
  voice_pack_id VARCHAR(36) NOT NULL REFERENCES voice_packs(id),
  conversation VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_packs_user ON voice_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_pack_msgs_receiver ON voice_pack_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_voice_pack_msgs_conversation ON voice_pack_messages(conversation);

CREATE TABLE IF NOT EXISTS images (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);

CREATE TABLE IF NOT EXISTS voice_recordings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  audio_data TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_recordings_user ON voice_recordings(user_id);

DO $$ BEGIN
  ALTER TABLE voice_recordings ADD COLUMN receiver_id VARCHAR(255) DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_voice_recordings_receiver ON voice_recordings(receiver_id);

DO $$ BEGIN
  ALTER TABLE voice_recordings ADD COLUMN reply_to VARCHAR(36) DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE voice_recordings ADD COLUMN reactions TEXT DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE voice_recordings ADD COLUMN seen BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
