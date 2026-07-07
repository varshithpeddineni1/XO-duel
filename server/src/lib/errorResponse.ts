// Shared error → response-shape mapping, used by both the HTTP error middleware and the
// Socket.io ack/error path, so REST and real-time errors look the same to a client
// (API-3: clear JSON shape, never leaking stack traces, SQL, or file paths).
import { ZodError } from 'zod';
import {
  AdminAuthRequiredError,
  AlreadyFriendsError,
  AlreadyRegisteredError,
  CannotFriendSelfError,
  FriendRequestNotFoundError,
  GameNotFoundError,
  GameNotInProgressError,
  GameNotJoinableError,
  IllegalMoveError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
  PlayerNotFoundError,
  RegistrationRequiredError,
  UsernameTakenError,
} from './errors.js';

export interface ErrorResponse {
  status: number;
  code: string;
  message: string;
}

export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: err.issues.map((issue) => issue.message).join('; '),
    };
  }
  if (err instanceof GameNotFoundError) {
    return { status: 404, code: 'GAME_NOT_FOUND', message: err.message };
  }
  if (err instanceof GameNotInProgressError) {
    return { status: 409, code: 'GAME_NOT_IN_PROGRESS', message: err.message };
  }
  if (err instanceof IllegalMoveError) {
    return { status: 400, code: 'ILLEGAL_MOVE', message: err.message };
  }
  if (err instanceof GameNotJoinableError) {
    return { status: 409, code: 'GAME_NOT_JOINABLE', message: err.message };
  }
  if (err instanceof UsernameTakenError) {
    return { status: 409, code: 'USERNAME_TAKEN', message: err.message };
  }
  if (err instanceof AlreadyRegisteredError) {
    return { status: 409, code: 'ALREADY_REGISTERED', message: err.message };
  }
  if (err instanceof InvalidCredentialsError) {
    return { status: 401, code: 'INVALID_CREDENTIALS', message: err.message };
  }
  if (err instanceof RegistrationRequiredError) {
    return { status: 403, code: 'REGISTRATION_REQUIRED', message: err.message };
  }
  if (err instanceof AdminAuthRequiredError) {
    return { status: 401, code: 'ADMIN_AUTH_REQUIRED', message: err.message };
  }
  if (err instanceof CannotFriendSelfError) {
    return { status: 400, code: 'CANNOT_FRIEND_SELF', message: err.message };
  }
  if (err instanceof AlreadyFriendsError) {
    return { status: 409, code: 'ALREADY_FRIENDS', message: err.message };
  }
  if (err instanceof FriendRequestNotFoundError) {
    return { status: 404, code: 'FRIEND_REQUEST_NOT_FOUND', message: err.message };
  }
  if (err instanceof InvalidInviteCodeError) {
    return { status: 404, code: 'INVALID_INVITE_CODE', message: err.message };
  }
  if (err instanceof PlayerNotFoundError) {
    return { status: 404, code: 'PLAYER_NOT_FOUND', message: err.message };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong.' };
}
