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

export class UsernameTakenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsernameTakenError';
  }
}

// This session's player row already has an account (SEC-3: register upgrades a guest row
// exactly once, never a second time).
export class AlreadyRegisteredError extends Error {
  constructor() {
    super('This session is already registered.');
    this.name = 'AlreadyRegisteredError';
  }
}

// Deliberately generic — never reveals whether the username exists (no enumeration).
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Incorrect username or password.');
    this.name = 'InvalidCredentialsError';
  }
}

// History, leaderboards, and friends are registered-account features (API-9) — a guest
// session is authenticated (it has a player row) but isn't eligible for these.
export class RegistrationRequiredError extends Error {
  constructor() {
    super('You need a registered account for this.');
    this.name = 'RegistrationRequiredError';
  }
}

export class AdminAuthRequiredError extends Error {
  constructor() {
    super('Admin sign-in required.');
    this.name = 'AdminAuthRequiredError';
  }
}

export class CannotFriendSelfError extends Error {
  constructor() {
    super("You can't friend yourself.");
    this.name = 'CannotFriendSelfError';
  }
}

export class AlreadyFriendsError extends Error {
  constructor() {
    super('You are already friends.');
    this.name = 'AlreadyFriendsError';
  }
}

export class FriendRequestNotFoundError extends Error {
  constructor() {
    super('No pending friend request found.');
    this.name = 'FriendRequestNotFoundError';
  }
}

export class InvalidInviteCodeError extends Error {
  constructor() {
    super('That invite link is not valid.');
    this.name = 'InvalidInviteCodeError';
  }
}

export class PlayerNotFoundError extends Error {
  constructor(username: string) {
    super(`No registered player found with username "${username}".`);
    this.name = 'PlayerNotFoundError';
  }
}
