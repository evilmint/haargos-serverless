import { pick } from 'lodash';

const UsersMeHandler = async (req, res, next) => {
  const allowedFields = ['userId', 'full_name', 'email'];
  const filteredUser = pick(req.user, allowedFields);

  res.json({ body: filteredUser });
};

export { UsersMeHandler };
