import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_VERSION = 4;

type Migration = {
    version: number;
    sql: string;
};

const MIGRATIONS: Migration[] = [
    {
        version: 1,
        sql: `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'archived')),
  summary TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (session_id, sequence)
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio', 'diagram', 'structured')),
  content_json TEXT NOT NULL,
  metadata_json TEXT,
  sequence INTEGER NOT NULL,
  UNIQUE (message_id, sequence)
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  user_need TEXT NOT NULL,
  context_summary TEXT NOT NULL,
  source_language TEXT,
  target_language TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'extracted', 'archived')),
  created_from TEXT NOT NULL CHECK (created_from IN ('auto_summary', 'manual_save', 'system_suggested')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiry_messages (
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary_question', 'clarification', 'answer', 'correction', 'supporting')),
  sequence INTEGER,
  PRIMARY KEY (inquiry_id, message_id, role)
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY NOT NULL,
  canonical_label TEXT NOT NULL,
  language_hint TEXT,
  definition TEXT,
  domain_json TEXT,
  aliases_json TEXT,
  disambiguation_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'merged', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expressions (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  language TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  part_of_speech TEXT,
  register TEXT,
  region TEXT,
  domain_json TEXT,
  meaning_note TEXT,
  usage_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'merged', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expression_concepts (
  expression_id TEXT NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('expresses', 'partially_expresses', 'ambiguous_with')),
  confidence REAL NOT NULL,
  PRIMARY KEY (expression_id, concept_id, relation)
);

CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY NOT NULL,
  template TEXT NOT NULL,
  language TEXT NOT NULL,
  slots_json TEXT NOT NULL,
  explanation TEXT,
  usage_scope TEXT,
  confidence REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('offline_induction', 'manual', 'system_suggested')),
  status TEXT NOT NULL CHECK (status IN ('candidate', 'active', 'rejected', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY NOT NULL,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  context_snapshot_json TEXT NOT NULL,
  explanation TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_point_utterances (
  id TEXT PRIMARY KEY NOT NULL,
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('recommended', 'alternative', 'contrast', 'incorrect', 'literal_translation')),
  usage_note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_point_entities (
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('concept', 'expression', 'pattern')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'supporting', 'contrast', 'context', 'derived')),
  PRIMARY KEY (knowledge_point_id, entity_type, entity_id, role)
);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY NOT NULL,
  from_type TEXT NOT NULL CHECK (from_type IN ('concept', 'expression', 'pattern', 'knowledge_point')),
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL CHECK (to_type IN ('concept', 'expression', 'pattern', 'knowledge_point')),
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('directed', 'undirected')),
  confidence REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'system', 'inquiry', 'offline')),
  status TEXT NOT NULL CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_targets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  ability TEXT NOT NULL CHECK (ability IN ('recognition', 'recall', 'contextual_production', 'transfer', 'distinction')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'mastered', 'archived')),
  priority INTEGER NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('low', 'medium', 'high')),
  stability REAL,
  due_at TEXT,
  last_reviewed_at TEXT,
  review_count INTEGER NOT NULL,
  lapse_count INTEGER NOT NULL,
  scheduling_algorithm TEXT,
  scheduling_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_target_entities (
  learning_target_id TEXT NOT NULL REFERENCES learning_targets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('concept', 'expression', 'pattern', 'utterance')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'prompt', 'required', 'contrast', 'supporting')),
  PRIMARY KEY (learning_target_id, entity_type, entity_id, role)
);

CREATE TABLE IF NOT EXISTS practice_items (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flashcard', 'free_response', 'translation', 'scenario_response', 'multiple_choice', 'correction')),
  prompt_json TEXT NOT NULL,
  expected_answer_json TEXT,
  acceptable_answers_json TEXT,
  context_snapshot_json TEXT,
  generated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_item_targets (
  practice_item_id TEXT NOT NULL REFERENCES practice_items(id) ON DELETE CASCADE,
  learning_target_id TEXT NOT NULL REFERENCES learning_targets(id) ON DELETE CASCADE,
  weight REAL NOT NULL,
  PRIMARY KEY (practice_item_id, learning_target_id)
);

CREATE TABLE IF NOT EXISTS user_responses (
  id TEXT PRIMARY KEY NOT NULL,
  practice_item_id TEXT NOT NULL REFERENCES practice_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  self_rating REAL,
  system_score REAL,
  feedback_json TEXT
);

CREATE TABLE IF NOT EXISTS learning_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  user_response_id TEXT NOT NULL REFERENCES user_responses(id) ON DELETE CASCADE,
  learning_target_id TEXT NOT NULL REFERENCES learning_targets(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('correct', 'partial', 'failed', 'hinted', 'exposed', 'not_tested')),
  score REAL,
  confidence REAL,
  error_types_json TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_sequence ON messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_content_blocks_message_sequence ON content_blocks(message_id, sequence);
CREATE INDEX IF NOT EXISTS idx_inquiries_session ON inquiries(session_id);
CREATE INDEX IF NOT EXISTS idx_concepts_label ON concepts(canonical_label);
CREATE INDEX IF NOT EXISTS idx_expressions_lookup ON expressions(language, normalized_text);
CREATE INDEX IF NOT EXISTS idx_patterns_language_status ON patterns(language, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_inquiry ON knowledge_points(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_kp_utterances_kp ON knowledge_point_utterances(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_type, to_id);
CREATE INDEX IF NOT EXISTS idx_learning_targets_user_due ON learning_targets(user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_learning_target_entities_entity ON learning_target_entities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_practice_item_targets_target ON practice_item_targets(learning_target_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_practice ON user_responses(practice_item_id);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_target_created ON learning_evidence(learning_target_id, created_at DESC);
`,
    },
    {
        version: 2,
        sql: `
INSERT OR IGNORE INTO relations (
  id, from_type, from_id, to_type, to_id, type, direction, confidence,
  source, status, evidence_json, created_at, updated_at
)
SELECT
  'expression_concept:' || expression_id || ':' || concept_id || ':' || relation,
  'expression',
  expression_id,
  'concept',
  concept_id,
  relation,
  'directed',
  confidence,
  'system',
  'confirmed',
  '{"migratedFrom":"expression_concepts"}',
  datetime('now'),
  datetime('now')
FROM expression_concepts;

DROP TABLE IF EXISTS expression_concepts;

ALTER TABLE sessions DROP COLUMN summary;

UPDATE learning_targets
SET difficulty = CASE
  WHEN difficulty IS NULL THEN NULL
  WHEN difficulty <= 1 THEN 'low'
  WHEN difficulty <= 2 THEN 'medium'
  ELSE 'high'
END
WHERE typeof(difficulty) IN ('integer', 'real');

ALTER TABLE user_responses DROP COLUMN self_rating;
ALTER TABLE user_responses DROP COLUMN system_score;

ALTER TABLE learning_evidence ADD COLUMN error_json TEXT;
UPDATE learning_evidence
SET error_json = error_types_json
WHERE error_types_json IS NOT NULL;
ALTER TABLE learning_evidence DROP COLUMN score;
ALTER TABLE learning_evidence DROP COLUMN error_types_json;
ALTER TABLE learning_evidence DROP COLUMN feedback;
`,
    },
    {
        version: 3,
        sql: `
ALTER TABLE sessions ADD COLUMN last_message_at TEXT;

UPDATE sessions
SET last_message_at = COALESCE(
  (
    SELECT MAX(messages.created_at)
    FROM messages
    WHERE messages.session_id = sessions.id
  ),
  started_at
)
WHERE last_message_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_last_message ON sessions(user_id, last_message_at DESC);
`,
    },
    {
        version: 4,
        sql: `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
    },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
    const row = await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version"
    );
    let currentVersion = row?.user_version ?? 0;

    for (const migration of MIGRATIONS) {
        if (migration.version <= currentVersion) {
            continue;
        }

        await db.withTransactionAsync(async () => {
            await db.execAsync(migration.sql);
            await db.execAsync(`PRAGMA user_version = ${migration.version}`);
        });

        currentVersion = migration.version;
    }
}
