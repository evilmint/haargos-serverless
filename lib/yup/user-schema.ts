import { object, string, boolean, array, number } from 'yup';

const userSchema = object().shape({
  full_name: string().max(32),
  email: string().required().max(64),
});

export default userSchema;
