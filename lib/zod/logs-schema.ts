import * as z from 'zod';

export const updateLogsSchema = z
  .object({
    content: z.string(),
    type: z.union([
      z.literal('core'),
      z.literal('supervisor'),
      z.literal('host'),
      z.literal('multicast'),
      z.literal('dns'),
      z.literal('audio'),
    ]),
  })
  .strict();
