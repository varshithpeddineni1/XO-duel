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
  },
} as const;
