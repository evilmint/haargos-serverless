const yup = require('yup');

const userSchema = yup.object().shape({
  full_name: yup.string().max(32),
  email: yup.string().required().max(64),
});

module.exports = userSchema;
