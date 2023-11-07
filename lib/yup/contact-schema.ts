import { z } from 'zod';

const contactSchema = z
  .object({
    name: z.string().min(1, 'Invalid name.'),
    email: z.string().email('Invalid email address.'),
    message: z.string().min(1, 'Invalid message.'),
  })
  .strict();
export default contactSchema;
