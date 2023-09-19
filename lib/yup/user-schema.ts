import { z } from 'zod';

const userSchema = z.object({
  full_name: z.string().max(32).optional(),
  email: z.string().max(64),
}).strict();

export default userSchema;
