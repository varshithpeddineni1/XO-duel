// Every request body/query/param is validated and typed with zod (CODE-2).
import { z } from 'zod';

export const friendSearchQuerySchema = z.object({
  q: z.string().min(1).max(50),
});

export const sendFriendRequestSchema = z.object({
  username: z.string().min(1),
});

export const friendRequestIdParamSchema = z.coerce.number().int().positive();

export const friendInviteCodeParamSchema = z
  .string()
  .regex(/^FR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
