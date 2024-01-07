import * as z from 'zod';

export const updateLogsSchema = z
  .object({
    content: z.string(),
    type: z.union([z.literal('core'), z.literal('supervisor')]),
  })
  .strict();
