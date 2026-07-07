// Typed domain errors, mapped to HTTP responses by middleware/errorHandler.ts. Messages are
// safe to return to clients — no stack traces, SQL, or file paths (API-3, CODE-6).
export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`No game found with id ${gameId}`);
    this.name = 'GameNotFoundError';
  }
}

export class GameNotInProgressError extends Error {
  constructor(gameId: string) {
    super(`Game ${gameId} is not in progress`);
    this.name = 'GameNotInProgressError';
  }
}

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

// A stale or already-taken invite code — never a silent success (API-5).
export class GameNotJoinableError extends Error {
  constructor(inviteCode: string) {
    super(`Game ${inviteCode} is not joinable`);
    this.name = 'GameNotJoinableError';
  }
}
