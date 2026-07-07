// Every request body is validated and typed with zod, never passed around untyped (CODE-2).
import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'medium', 'hard', 'impossible']);
export type DifficultyInput = z.infer<typeof difficultySchema>;

export const createGameSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('local') }),
  z.object({ mode: z.literal('ai'), aiDifficulty: difficultySchema }),
]);
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const markSchema = z.enum(['X', 'O']);

export const makeMoveSchema = z.object({
  cell: z.number().int().min(0).max(8),
  mark: markSchema,
});
export type MakeMoveInput = z.infer<typeof makeMoveSchema>;

export const gameIdParamSchema = z.coerce.number().int().positive();
