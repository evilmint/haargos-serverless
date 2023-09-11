import userSchema from '../lib/yup/user-schema';
const { deleteAccount, updateAccount } = require('../services/account-service');
import { Request, Response } from 'express';

interface User {
  userId: string;
  secret: string;
}

interface TypedRequestBody<T> extends Request {
  body: T;
  user: User;
}

export const DeleteAccountHandler = async (
  req: TypedRequestBody<{ user: { userId: string } }>,
  res: Response,
) => {
  try {
    await deleteAccount(req.user.userId, req.user.secret);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

export const UpdateAccountHandler = async (
  req: TypedRequestBody<{ email: string; full_name: string }>,
  res: Response,
) => {
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
