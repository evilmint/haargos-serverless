import { object, string } from 'yup';

const installationSchema = object().shape({
  name: string().min(2).max(32).required(),
  instance: string().max(64),
});

export default installationSchema;
