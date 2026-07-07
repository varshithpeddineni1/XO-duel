// OpenAPI document for the REST surface (API-1). A plain object rather than a YAML file —
// avoids adding a YAML-parsing dependency for something this small. Served via Swagger UI
// at /api/docs in non-production (see index.ts).
const gameStateSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    mode: { type: 'string', enum: ['local', 'ai', 'online'] },
    aiDifficulty: {
      type: 'string',
      enum: ['easy', 'medium', 'hard', 'impossible'],
      nullable: true,
    },
    inviteCode: { type: 'string', nullable: true },
    board: {
      type: 'array',
      items: { type: 'string', enum: ['X', 'O'], nullable: true },
      minItems: 9,
      maxItems: 9,
    },
    currentPlayer: { type: 'string', enum: ['X', 'O'] },
    status: { type: 'string', enum: ['waiting', 'in_progress', 'complete', 'abandoned'] },
    winner: { type: 'string', enum: ['X', 'O', 'draw'], nullable: true },
    winLine: {
      type: 'array',
      items: { type: 'integer' },
      nullable: true,
    },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

const playerStateSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    nickname: { type: 'string' },
    username: { type: 'string', nullable: true },
    isRegistered: { type: 'boolean' },
    inviteCode: { type: 'string', nullable: true },
    stats: {
      type: 'object',
      nullable: true,
      properties: {
        wins: { type: 'integer' },
        losses: { type: 'integer' },
        draws: { type: 'integer' },
      },
    },
  },
};

const historyEntrySchema = {
  type: 'object',
  properties: {
    gameId: { type: 'integer' },
    mode: { type: 'string', enum: ['local', 'ai', 'online'] },
    opponentLabel: { type: 'string' },
    outcome: { type: 'string', enum: ['win', 'loss', 'draw'] },
    completedAt: { type: 'string', format: 'date-time' },
  },
};

const leaderboardEntrySchema = {
  type: 'object',
  properties: {
    playerId: { type: 'integer' },
    displayName: { type: 'string' },
    wins: { type: 'integer' },
    losses: { type: 'integer' },
    draws: { type: 'integer' },
    gamesPlayed: { type: 'integer' },
    winRate: { type: 'number' },
  },
};

const friendSummarySchema = {
  type: 'object',
  properties: {
    playerId: { type: 'integer' },
    displayName: { type: 'string' },
  },
};

const pendingRequestSchema = {
  type: 'object',
  properties: {
    requestId: { type: 'integer' },
    direction: { type: 'string', enum: ['incoming', 'outgoing'] },
    playerId: { type: 'integer' },
    displayName: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const adminStatsSchema = {
  type: 'object',
  properties: {
    activePlayers: { type: 'integer' },
    gamesInProgress: { type: 'integer' },
    gamesOverTime: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string', format: 'date' }, count: { type: 'integer' } },
      },
    },
    outcomeDistribution: {
      type: 'object',
      properties: {
        xWins: { type: 'integer' },
        oWins: { type: 'integer' },
        draws: { type: 'integer' },
      },
    },
  },
};

const adminPlayerSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    displayName: { type: 'string' },
    isRegistered: { type: 'boolean' },
    lastSeenAt: { type: 'string', format: 'date-time' },
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'XO Duel API',
    version: '0.1.0',
    description:
      'Local 2-player, vs-AI, and real-time online play; optional guest-to-registered accounts.',
  },
  paths: {
    '/api/session': {
      post: {
        summary: 'Create or resume a guest session (no login required, API-7)',
        responses: {
          '200': {
            description: 'Current player for this session (created if none existed yet)',
            content: { 'application/json': { schema: playerStateSchema } },
          },
        },
      },
    },
    '/api/me': {
      get: {
        summary: 'Current session player, guest or registered',
        responses: {
          '200': {
            description: 'The current player, or null if no session has been established yet',
            content: { 'application/json': { schema: playerStateSchema, nullable: true } },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: "Upgrade this session's guest player to a registered account, in place",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 20 },
                  password: { type: 'string', minLength: 8 },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Registered player',
            content: { 'application/json': { schema: playerStateSchema } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
          '409': {
            description: 'Username already taken, or this session is already registered',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in to a registered account (rate-limited, API-10)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Logged-in player',
            content: { 'application/json': { schema: playerStateSchema } },
          },
          '401': {
            description: 'Incorrect username or password',
            content: { 'application/json': { schema: errorSchema } },
          },
          '429': {
            description: 'Too many login attempts',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'End the current session',
        responses: {
          '204': { description: 'Logged out' },
        },
      },
    },
    '/api/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { status: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    '/api/games': {
      post: {
        summary: 'Create a local, vs-AI, or online game',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { type: 'object', properties: { mode: { const: 'local' } } },
                  {
                    type: 'object',
                    properties: {
                      mode: { const: 'ai' },
                      aiDifficulty: {
                        type: 'string',
                        enum: ['easy', 'medium', 'hard', 'impossible'],
                      },
                    },
                  },
                  { type: 'object', properties: { mode: { const: 'online' } } },
                ],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Game created',
            content: { 'application/json': { schema: gameStateSchema } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/games/invite/{code}': {
      get: {
        summary: 'Look up an online game by its invite code',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Game state',
            content: { 'application/json': { schema: gameStateSchema } },
          },
          '404': {
            description: 'No game with that invite code',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/games/{id}': {
      get: {
        summary: 'Get current game state',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'Game state',
            content: { 'application/json': { schema: gameStateSchema } },
          },
          '404': {
            description: 'Game not found',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/games/{id}/moves': {
      post: {
        summary:
          'Submit a move (server validates turn order and legality; computes the AI reply for vs-AI games)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cell: { type: 'integer', minimum: 0, maximum: 8 },
                  mark: { type: 'string', enum: ['X', 'O'] },
                },
                required: ['cell', 'mark'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated game state',
            content: { 'application/json': { schema: gameStateSchema } },
          },
          '400': {
            description: 'Illegal move or validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
          '404': {
            description: 'Game not found',
            content: { 'application/json': { schema: errorSchema } },
          },
          '409': {
            description: 'Game is not in progress',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/games/history': {
      get: {
        summary: "The current (registered) player's completed games",
        parameters: [
          {
            name: 'mode',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['local', 'ai', 'online'] },
          },
        ],
        responses: {
          '200': {
            description: 'Completed games, most recent first',
            content: {
              'application/json': { schema: { type: 'array', items: historyEntrySchema } },
            },
          },
          '403': {
            description: 'Registration required',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/leaderboard/global': {
      get: {
        summary:
          'Global leaderboard — online games between two registered players only, min. 5 games, ranked by win rate (API-9, DB-7)',
        responses: {
          '200': {
            description: 'Ranked leaderboard entries',
            content: {
              'application/json': { schema: { type: 'array', items: leaderboardEntrySchema } },
            },
          },
        },
      },
    },
    '/api/friends': {
      get: {
        summary: 'Accepted friends',
        responses: {
          '200': {
            description: 'Friends list',
            content: {
              'application/json': { schema: { type: 'array', items: friendSummarySchema } },
            },
          },
          '403': {
            description: 'Registration required',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/friends/requests': {
      get: {
        summary: 'Pending friend requests, incoming and outgoing',
        responses: {
          '200': {
            description: 'Pending requests',
            content: {
              'application/json': { schema: { type: 'array', items: pendingRequestSchema } },
            },
          },
        },
      },
      post: {
        summary: 'Send a friend request by username',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { username: { type: 'string' } },
                required: ['username'],
              },
            },
          },
        },
        responses: {
          '204': { description: 'Request sent (or, if mutual, instantly accepted)' },
          '400': {
            description: "Can't friend yourself",
            content: { 'application/json': { schema: errorSchema } },
          },
          '404': {
            description: 'No registered player with that username',
            content: { 'application/json': { schema: errorSchema } },
          },
          '409': {
            description: 'Already friends',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/friends/requests/{id}/accept': {
      post: {
        summary: 'Accept a pending friend request',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '204': { description: 'Accepted' },
          '404': {
            description: 'No pending request found',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/friends/requests/{id}/decline': {
      post: {
        summary: 'Decline a pending friend request (deletes it — the pair can re-request later)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '204': { description: 'Declined' },
          '404': {
            description: 'No pending request found',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/friends/search': {
      get: {
        summary: 'Search registered players by username prefix',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Matching players',
            content: {
              'application/json': { schema: { type: 'array', items: friendSummarySchema } },
            },
          },
        },
      },
    },
    '/api/friends/leaderboard': {
      get: {
        summary: 'Leaderboard scoped to me + my friends (same ranking rules as global)',
        responses: {
          '200': {
            description: 'Ranked leaderboard entries',
            content: {
              'application/json': { schema: { type: 'array', items: leaderboardEntrySchema } },
            },
          },
        },
      },
    },
    '/api/friends/invite/{code}': {
      post: {
        summary:
          "Accept a friend's personal invite link — reusable, instant accept, no separate request step (SEC-4)",
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '204': { description: 'Now friends' },
          '400': {
            description: "Can't friend yourself",
            content: { 'application/json': { schema: errorSchema } },
          },
          '404': {
            description: 'Invalid invite code',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/admin/login': {
      post: {
        summary: 'Admin sign-in (single env-configured identity, rate-limited, API-10)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { username: { type: 'string' }, password: { type: 'string' } },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Signed in' },
          '401': {
            description: 'Incorrect admin credentials',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/admin/logout': {
      post: {
        summary: 'End the admin session',
        responses: { '204': { description: 'Logged out' } },
      },
    },
    '/api/admin/stats': {
      get: {
        summary:
          'Active players, games in progress, games over the last 7 days, outcome distribution (OBS-3). Read-only (SEC-10).',
        responses: {
          '200': {
            description: 'Dashboard stats',
            content: { 'application/json': { schema: adminStatsSchema } },
          },
          '401': {
            description: 'Admin sign-in required',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/api/admin/players': {
      get: {
        summary: 'List players, guest and registered, most recently active first',
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'Players',
            content: {
              'application/json': { schema: { type: 'array', items: adminPlayerSchema } },
            },
          },
          '401': {
            description: 'Admin sign-in required',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
  },
} as const;
