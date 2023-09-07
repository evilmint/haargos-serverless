const userSchema = require('../lib/yup/user-schema');
const { deleteAccount, updateAccount } = require('../services/account-service');

const DeleteAccountHandler = async (req, res) => {
  try {
    await deleteAccount(req.user.userId, req.user.secret);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

const UpdateAccountHandler = async (req, res) => {
  try {
    await userSchema.validate(req.body, { abortEarly: true });
  
    const { email, full_name: fullName } = req.body;

    await updateAccount(req.user.userId, req.user.secret, email, fullName);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

module.exports = {
  UpdateAccountHandler,
  DeleteAccountHandler,
};
