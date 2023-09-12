import * as z from 'zod';
import ipaddr from 'ipaddr.js';

const updateInstallationFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.',
    })
    .max(30, {
      message: 'Name must not be longer than 32 characters.',
    }),
  instance: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .url()
      .refine(i => {
        return new URL(i).protocol.toLowerCase() == 'https:';
      }, 'Only HTTPS URLs are allowed.')
      .refine(i => {
        try {
          const _ = ipaddr.parse(new URL(i).host);
          return false;
        } catch {
          return true;
        }
      }, 'IP addresses are not allowed.'),
  ]),
});

export default updateInstallationFormSchema;
