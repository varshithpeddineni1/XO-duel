// Supertest against the real Express app + a real Postgres (API-4). Needs DATABASE_URL and
// a migrated database — run via `npm run test:integration`, not the default `npm test`
// (CLAUDE.md: the default gate stays DB-free). See vitest.integration.config.ts.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

type Mark = 'X' | 'O';

const app = createApp();

function createGame(body: Record<string, unknown>) {
  return request(app).post('/api/games').send(body);
}

describe('POST /api/games', () => {
  it('creates a local game', async () => {
    const res = await createGame({ mode: 'local' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      mode: 'local',
      aiDifficulty: null,
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'in_progress',
      winner: null,
    });
    expect(typeof res.body.id).toBe('number');
  });

  it.each(['easy', 'medium', 'hard', 'impossible'] as const)(
    'creates an ai game with difficulty %s',
    async (difficulty) => {
      const res = await createGame({ mode: 'ai', aiDifficulty: difficulty });
      expect(res.status).toBe(201);
      expect(res.body.mode).toBe('ai');
      expect(res.body.aiDifficulty).toBe(difficulty);
    },
  );

  it('rejects an invalid mode', async () => {
    const res = await createGame({ mode: 'bogus' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/games/:id', () => {
  it('returns 404 for a non-existent game', async () => {
    const res = await request(app).get('/api/games/999999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('GAME_NOT_FOUND');
  });

  it('returns the current state of a real game', async () => {
    const created = await createGame({ mode: 'local' });
    const res = await request(app).get(`/api/games/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });
});

describe('POST /api/games/:id/moves — local mode', () => {
  it('applies a valid move and advances the turn', async () => {
    const created = await createGame({ mode: 'local' });
    const res = await request(app)
      .post(`/api/games/${created.body.id}/moves`)
      .send({ cell: 0, mark: 'X' });
    expect(res.status).toBe(200);
    expect(res.body.board[0]).toBe('X');
    expect(res.body.currentPlayer).toBe('O');
    expect(res.body.status).toBe('in_progress');
  });

  it('rejects an out-of-turn mark', async () => {
    const created = await createGame({ mode: 'local' });
    const res = await request(app)
      .post(`/api/games/${created.body.id}/moves`)
      .send({ cell: 0, mark: 'O' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_MOVE');
  });

  it('rejects a move on an occupied cell', async () => {
    const created = await createGame({ mode: 'local' });
    await request(app).post(`/api/games/${created.body.id}/moves`).send({ cell: 0, mark: 'X' });
    const res = await request(app)
      .post(`/api/games/${created.body.id}/moves`)
      .send({ cell: 0, mark: 'O' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_MOVE');
  });

  it('rejects a cell outside the board', async () => {
    const created = await createGame({ mode: 'local' });
    const res = await request(app)
      .post(`/api/games/${created.body.id}/moves`)
      .send({ cell: 9, mark: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('plays a full game to a win and records outcomes', async () => {
    const created = await createGame({ mode: 'local' });
    const id = created.body.id;
    const moves: Array<{ cell: number; mark: Mark }> = [
      { cell: 0, mark: 'X' },
      { cell: 3, mark: 'O' },
      { cell: 1, mark: 'X' },
      { cell: 4, mark: 'O' },
      { cell: 2, mark: 'X' }, // completes the top row
    ];
    let last;
    for (const move of moves) {
      last = await request(app).post(`/api/games/${id}/moves`).send(move);
    }
    expect(last!.status).toBe(200);
    expect(last!.body.status).toBe('complete');
    expect(last!.body.winner).toBe('X');
    expect(last!.body.winLine).toEqual([0, 1, 2]);
  });

  it('rejects any further move once the game is complete', async () => {
    const created = await createGame({ mode: 'local' });
    const id = created.body.id;
    const moves: Array<{ cell: number; mark: Mark }> = [
      { cell: 0, mark: 'X' },
      { cell: 3, mark: 'O' },
      { cell: 1, mark: 'X' },
      { cell: 4, mark: 'O' },
      { cell: 2, mark: 'X' },
    ];
    for (const move of moves) {
      await request(app).post(`/api/games/${id}/moves`).send(move);
    }
    const res = await request(app).post(`/api/games/${id}/moves`).send({ cell: 5, mark: 'O' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GAME_NOT_IN_PROGRESS');
  });
});

describe('POST /api/games/:id/moves — ai mode', () => {
  it("computes the AI's reply server-side and never accepts a client-submitted O move", async () => {
    const created = await createGame({ mode: 'ai', aiDifficulty: 'easy' });
    const id = created.body.id;

    const rejected = await request(app).post(`/api/games/${id}/moves`).send({ cell: 0, mark: 'O' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('ILLEGAL_MOVE');

    const res = await request(app).post(`/api/games/${id}/moves`).send({ cell: 0, mark: 'X' });
    expect(res.status).toBe(200);
    expect(res.body.board[0]).toBe('X');
    const oCount = (res.body.board as Array<string | null>).filter((cell) => cell === 'O').length;
    expect(oCount).toBe(1); // the AI's reply, applied server-side in the same request
    expect(res.body.currentPlayer).toBe('X');
  });

  it('the impossible AI tier never loses — X can win only a draw at best', async () => {
    const created = await createGame({ mode: 'ai', aiDifficulty: 'impossible' });
    const id = created.body.id;
    let state = created.body;

    while (state.status === 'in_progress') {
      const cell = (state.board as Array<string | null>).findIndex((c) => c === null);
      const res = await request(app).post(`/api/games/${id}/moves`).send({ cell, mark: 'X' });
      expect(res.status).toBe(200);
      state = res.body;
    }

    // The AI plays O, so "the AI never loses" means X never wins — X (playing an
    // intentionally naive "first empty cell" strategy here) draws at best, and the
    // perfect AI is free to win outright.
    expect(state.winner).not.toBe('X');
  });
});
