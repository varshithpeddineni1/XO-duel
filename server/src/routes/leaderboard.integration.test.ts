// Real socket.io-client connections (like sockets/gameSocket.integration.test.ts) against a
// real http.Server + Postgres — needed because online-game player attribution only happens
// once a socket shares the same session a REST call registered under (see index.ts's
// createServer: io.engine.use(sessionMiddleware)). Cookies are threaded through manually
// (not supertest's request.agent) since the same cookie also has to be handed to the
// socket connection's extraHeaders, not just further REST calls.
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
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

afterEach(() => {
  for (const client of openClients.splice(0)) client.disconnect();
});

function connectWithCookie(cookie: string): ClientSocket {
  const socket = ioClient(serverUrl, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: { Cookie: cookie },
  });
  openClients.push(socket);
  return socket;
}

function emitAck<T = unknown>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!raw?.length) throw new Error('no Set-Cookie header in response');
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function registerPlayer(label: string) {
  const sessionRes = await request(serverUrl).post('/api/session').send({});
  const cookie = cookieHeader(sessionRes);
  const username = `${label}_${sessionRes.body.id as number}`;
  await request(serverUrl)
    .post('/api/auth/register')
    .set('Cookie', cookie)
    .send({ username, password: 'longenough' });
  return { cookie, playerId: sessionRes.body.id as number, username };
}

// Plays exactly one online game to completion between two already-registered cookies,
// with X always winning the top row — used to grind up to the ranking formula's
// minimum-games threshold (win rate, >= 5 games — a resolved open spec decision).
async function playOneOnlineGame(cookieX: string, cookieO: string): Promise<void> {
  const created = await request(serverUrl)
    .post('/api/games')
    .set('Cookie', cookieX)
    .send({ mode: 'online' });
  const inviteCode = created.body.inviteCode as string;

  const x = connectWithCookie(cookieX);
  const o = connectWithCookie(cookieO);
  await emitAck(x, 'join_game', { inviteCode });
  await emitAck(o, 'join_game', { inviteCode });

  const moves: Array<[ClientSocket, number]> = [
    [x, 0],
    [o, 3],
    [x, 1],
    [o, 4],
    [x, 2], // completes the top row
  ];
  for (const [socket, cell] of moves) {
    await emitAck(socket, 'make_move', { cell });
  }
  x.disconnect();
  o.disconnect();
}

describe('global leaderboard', () => {
  it('reflects online games between two registered players once they hit the min-games threshold', async () => {
    const winner = await registerPlayer('lbwinner');
    const loser = await registerPlayer('lbloser');

    for (let i = 0; i < 5; i++) {
      await playOneOnlineGame(winner.cookie, loser.cookie);
    }

    const board = await request(serverUrl).get('/api/leaderboard/global');
    expect(board.status).toBe(200);
    const winnerEntry = board.body.find(
      (e: { playerId: number }) => e.playerId === winner.playerId,
    );
    expect(winnerEntry).toMatchObject({
      wins: 5,
      losses: 0,
      draws: 0,
      gamesPlayed: 5,
      winRate: 100,
    });
    const loserEntry = board.body.find((e: { playerId: number }) => e.playerId === loser.playerId);
    expect(loserEntry).toMatchObject({ wins: 0, losses: 5, draws: 0, gamesPlayed: 5, winRate: 0 });
  }, 15_000);

  it('excludes a player below the minimum-games threshold', async () => {
    const winner = await registerPlayer('belowthresholdA');
    const loser = await registerPlayer('belowthresholdB');
    await playOneOnlineGame(winner.cookie, loser.cookie); // only 1 game, threshold is 5

    const board = await request(serverUrl).get('/api/leaderboard/global');
    expect(board.body.some((e: { playerId: number }) => e.playerId === winner.playerId)).toBe(
      false,
    );
  });

  it('excludes local and AI games entirely (API-9)', async () => {
    const player = await registerPlayer('localexcludedplayer');
    for (let i = 0; i < 5; i++) {
      const game = await request(serverUrl)
        .post('/api/games')
        .set('Cookie', player.cookie)
        .send({ mode: 'local' });
      await request(serverUrl)
        .post(`/api/games/${game.body.id}/moves`)
        .set('Cookie', player.cookie)
        .send({ cell: 0, mark: 'X' });
    }

    const board = await request(serverUrl).get('/api/leaderboard/global');
    expect(board.body.some((e: { playerId: number }) => e.playerId === player.playerId)).toBe(
      false,
    );
  });
});

describe('friend leaderboard', () => {
  it("is scoped to me + my friends, excluding a non-friend's ranked entry", async () => {
    const me = await registerPlayer('friendlbme');
    const friend = await registerPlayer('friendlbfriend');
    const stranger = await registerPlayer('friendlbstranger');

    await request(serverUrl)
      .post('/api/friends/requests')
      .set('Cookie', me.cookie)
      .send({ username: friend.username });
    const pending = await request(serverUrl)
      .get('/api/friends/requests')
      .set('Cookie', friend.cookie);
    const incoming = pending.body.find((r: { playerId: number }) => r.playerId === me.playerId);
    await request(serverUrl)
      .post(`/api/friends/requests/${incoming.requestId}/accept`)
      .set('Cookie', friend.cookie);

    for (let i = 0; i < 5; i++) {
      await playOneOnlineGame(friend.cookie, stranger.cookie);
      await playOneOnlineGame(stranger.cookie, friend.cookie); // stranger also qualifies
    }

    const board = await request(serverUrl).get('/api/friends/leaderboard').set('Cookie', me.cookie);
    expect(board.status).toBe(200);
    expect(board.body.some((e: { playerId: number }) => e.playerId === friend.playerId)).toBe(true);
    expect(board.body.some((e: { playerId: number }) => e.playerId === stranger.playerId)).toBe(
      false,
    );
  }, 30_000);
});
