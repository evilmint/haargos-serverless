import * as z from 'zod';

export const osSchema = z
  .object({
    version: z.string(),
    version_latest: z.string(),
    update_available: z.boolean(),
    board: z.string(),
    boot: z.string(),
    data_disk: z.string(),
  })
  .strict();
