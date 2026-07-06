/**
 * Initial schema (DB-2: versioned migrations only, no hand-edited schema).
 * Tables/columns are snake_case (DB-3). Schema per implementation-plan.md §"Schema
 * (initial migration)". Leaderboards are derived on read from game_players — no
 * ranking table here (DB-7).
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
export const shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('players', {
    id: 'id',
    nickname: { type: 'text', notNull: true },
    session_token: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    username: { type: 'text', unique: true },
    password_hash: { type: 'text' },
    is_registered: { type: 'boolean', notNull: true, default: false },
    invite_code: { type: 'text', unique: true },
  });

  pgm.createTable('friendships', {
    id: 'id',
    requester_id: {
      type: 'integer',
      notNull: true,
      references: 'players',
      onDelete: 'cascade',
    },
    addressee_id: {
      type: 'integer',
      notNull: true,
      references: 'players',
      onDelete: 'cascade',
    },
    status: { type: 'text', notNull: true, check: "status in ('pending', 'accepted')" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('friendships', 'friendships_pair_unique', {
    unique: ['requester_id', 'addressee_id'],
  });
  pgm.createIndex('friendships', ['requester_id', 'addressee_id']);

  pgm.createTable('games', {
    id: 'id',
    mode: { type: 'text', notNull: true, check: "mode in ('local', 'ai', 'online')" },
    invite_code: { type: 'text', unique: true },
    ai_difficulty: {
      type: 'text',
      check: "ai_difficulty in ('easy', 'medium', 'hard', 'impossible')",
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'waiting',
      check: "status in ('waiting', 'in_progress', 'complete', 'abandoned')",
    },
    winner_player_id: { type: 'integer', references: 'players', onDelete: 'set null' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    completed_at: { type: 'timestamptz' },
  });
  pgm.createIndex('games', 'invite_code');

  pgm.createTable('game_players', {
    id: 'id',
    game_id: { type: 'integer', notNull: true, references: 'games', onDelete: 'cascade' },
    player_id: { type: 'integer', references: 'players', onDelete: 'set null' },
    mark: { type: 'text', notNull: true, check: "mark in ('X', 'O')" },
    outcome: { type: 'text', check: "outcome in ('win', 'loss', 'draw')" },
  });
  pgm.createIndex('game_players', 'game_id');
  pgm.createIndex('game_players', 'player_id');

  pgm.createTable('moves', {
    id: 'id',
    game_id: { type: 'integer', notNull: true, references: 'games', onDelete: 'cascade' },
    player_id: { type: 'integer', references: 'players', onDelete: 'set null' },
    cell: { type: 'integer', notNull: true, check: 'cell >= 0 and cell <= 8' },
    mark: { type: 'text', notNull: true, check: "mark in ('X', 'O')" },
    move_number: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('moves', ['game_id', 'move_number']);

  pgm.createTable('events', {
    id: 'id',
    game_id: { type: 'integer', references: 'games', onDelete: 'cascade' },
    type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('events', 'game_id');

  // connect-pg-simple's documented session table shape — kept as raw SQL so it matches
  // that package's schema exactly (it manages this table itself at runtime).
  pgm.sql(`
    CREATE TABLE "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    ) WITH (OIDS=FALSE);
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
    CREATE INDEX "IDX_session_expire" ON "session" ("expire");
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS "session";');
  pgm.dropTable('events');
  pgm.dropTable('moves');
  pgm.dropTable('game_players');
  pgm.dropTable('games');
  pgm.dropTable('friendships');
  pgm.dropTable('players');
};
