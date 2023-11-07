import { z } from 'zod';

const createAccountSchema = z.object({
  userFullName: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.',
    })
    .max(30, {
      message: 'Name must not be longer than 32 characters.',
    }),
});
//.strict();
export default createAccountSchema;
