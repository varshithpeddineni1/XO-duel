// Two real socket.io-client connections against a real http.Server + Postgres (API-4's
// spirit extended to the real-time surface). Needs DATABASE_URL and a migrated database —
// run via `npm run test:integration`, not the default `npm test`. Grace period is
// shortened to 300ms via vitest.integration.config.ts so the forfeit test doesn't wait out
// the real 30s production default.
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../index.js';

let serverUrl: string;
let httpServer: ReturnType<typeof createServer>['httpServer'];

beforeAll(async () => {
  const created = createServer();
  httpServer = created.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  const address = httpServer.address() as AddressInfo;
  serverUrl = `http://localhost:${address.port}`;
});

afterAll(() => {
  httpServer.close();
});

const openClients: ClientSocket[] = [];

function connectClient(): ClientSocket {
  const socket = ioClient(serverUrl, { transports: ['websocket'], forceNew: true });
  openClients.push(socket);
  return socket;
}

afterEach(() => {
  for (const client of openClients.splice(0)) client.disconnect();
});

function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck<T = unknown>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function createOnlineGame(): Promise<{ id: number; inviteCode: string }> {
  const res = await fetch(`${serverUrl}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'online' }),
  });
  const body = (await res.json()) as { id: number; inviteCode: string };
  return body;
}

describe('join_game', () => {
  it('creator binds X; the second joiner binds O and starts the game', async () => {
    const { inviteCode } = await createOnlineGame();
    const creator = connectClient();
    const joiner = connectClient();

    const creatorAck = await emitAck<{ ok: true; role: string }>(creator, 'join_game', {
      inviteCode,
    });
    expect(creatorAck.role).toBe('X');

    const joinedPromise = waitFor<{ game: { status: string } }>(creator, 'player_joined');
    const joinerAck = await emitAck<{ ok: true; role: string }>(joiner, 'join_game', {
      inviteCode,
    });
    expect(joinerAck.role).toBe('O');
    expect((await joinedPromise).game.status).toBe('in_progress');
  });

  it('rejects joining a code that is already full (API-5)', async () => {
    const { inviteCode } = await createOnlineGame();
    const creator = connectClient();
    const joiner = connectClient();
    const thirdWheel = connectClient();

    await emitAck(creator, 'join_game', { inviteCode });
    await emitAck(joiner, 'join_game', { inviteCode });
    const rejected = await emitAck<{ ok: false; error: { code: string } }>(
      thirdWheel,
      'join_game',
      { inviteCode },
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.error.code).toBe('GAME_NOT_JOINABLE');
  });
});

describe('make_move', () => {
  it('plays a full game to completion over sockets', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    const moves: Array<[ClientSocket, number]> = [
      [x, 0],
      [o, 3],
      [x, 1],
      [o, 4],
      [x, 2], // completes the top row
    ];
    let last: { ok: true; game: { status: string; winner: string | null } } | undefined;
    for (const [socket, cell] of moves) {
      last = await emitAck(socket, 'make_move', { cell });
    }
    expect(last?.game.status).toBe('complete');
    expect(last?.game.winner).toBe('X');
  });

  it('rejects an out-of-turn move', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    const rejected = await emitAck<{ ok: false; error: { code: string } }>(o, 'make_move', {
      cell: 0,
    });
    expect(rejected.error.code).toBe('ILLEGAL_MOVE');
  });

  it('rejects a move on an occupied cell', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    await emitAck(x, 'make_move', { cell: 0 });
    const rejected = await emitAck<{ ok: false; error: { code: string } }>(o, 'make_move', {
      cell: 0,
    });
    expect(rejected.error.code).toBe('ILLEGAL_MOVE');
  });
});

describe('disconnect / reconnect', () => {
  it('auto-forfeits to the connected player once the grace period elapses', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    const disconnectedPromise = waitFor(x, 'player_disconnected');
    const gameOverPromise = waitFor<{ game: { winner: string }; reason: string }>(x, 'game_over');
    o.disconnect();
    await disconnectedPromise;

    const gameOver = await gameOverPromise;
    expect(gameOver.reason).toBe('forfeit');
    expect(gameOver.game.winner).toBe('X');
  }, 10_000);

  it('reconnecting within the grace period cancels the forfeit', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    let o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    const joinAck = await emitAck<{ ok: true; reconnectToken: string }>(o, 'join_game', {
      inviteCode,
    });

    const disconnectedPromise = waitFor(x, 'player_disconnected');
    o.disconnect();
    await disconnectedPromise;

    o = connectClient();
    const reconnectedPromise = waitFor(x, 'player_reconnected');
    const rejoinAck = await emitAck<{ ok: true; role: string }>(o, 'join_game', {
      inviteCode,
      reconnectToken: joinAck.reconnectToken,
    });
    expect(rejoinAck.role).toBe('O');
    await reconnectedPromise;
  });
});

describe('rematch', () => {
  it('request then accept starts a fresh game for both sockets', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    const requestedPromise = waitFor<{ by: string }>(o, 'rematch_requested');
    x.emit('request_rematch');
    expect((await requestedPromise).by).toBe('X');

    const acceptedXPromise = waitFor<{ game: { id: number; status: string } }>(
      x,
      'rematch_accepted',
    );
    const acceptedOPromise = waitFor<{ game: { id: number } }>(o, 'rematch_accepted');
    o.emit('accept_rematch');
    const [acceptedX, acceptedO] = await Promise.all([acceptedXPromise, acceptedOPromise]);
    expect(acceptedX.game.id).toBe(acceptedO.game.id);
    expect(acceptedX.game.status).toBe('in_progress');
  });

  it('request then decline notifies the requester', async () => {
    const { inviteCode } = await createOnlineGame();
    const x = connectClient();
    const o = connectClient();
    await emitAck(x, 'join_game', { inviteCode });
    await emitAck(o, 'join_game', { inviteCode });

    x.emit('request_rematch');
    const declinedPromise = waitFor<{ by: string }>(x, 'rematch_declined');
    o.emit('decline_rematch');
    expect((await declinedPromise).by).toBe('O');
  });
});
