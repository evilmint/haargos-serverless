const yup = require('yup');

const installationSchema = yup.object().shape({
  name: yup.string().min(2).max(32).required(),
  instance: yup.string().max(64),
});

module.exports = installationSchema;
