// OpenAPI document for the REST surface (API-1). A plain object rather than a YAML file —
// avoids adding a YAML-parsing dependency for something this small. Served via Swagger UI
// at /api/docs in non-production (see index.ts).
const gameStateSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    mode: { type: 'string', enum: ['local', 'ai'] },
    aiDifficulty: {
      type: 'string',
      enum: ['easy', 'medium', 'hard', 'impossible'],
      nullable: true,
    },
    board: {
      type: 'array',
      items: { type: 'string', enum: ['X', 'O'], nullable: true },
      minItems: 9,
      maxItems: 9,
    },
    currentPlayer: { type: 'string', enum: ['X', 'O'] },
    status: { type: 'string', enum: ['in_progress', 'complete'] },
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

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'XO Duel API',
    version: '0.1.0',
    description: 'Phase 2: local 2-player and vs-AI game creation/play. No accounts yet.',
  },
  paths: {
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
        summary: 'Create a local or vs-AI game',
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
