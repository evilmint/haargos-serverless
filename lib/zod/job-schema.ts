import { z } from 'zod';

const submitJobSchema = z.object({
  type: z.union([z.literal('update_addon'), z.literal('update_supervisor')]),
  context: z.union([
    z.literal('unimplemented'),
    z.object({
      addon_id: z.string(),
    }),
  ]),
});

export { submitJobSchema };
