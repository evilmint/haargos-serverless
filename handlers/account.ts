import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { User } from '../lib/base-request';
import createAccountSchema from '../lib/yup/account-schema';
import userSchema from '../lib/yup/user-schema';
import { createAccount } from '../services/account-service';
const { deleteAccount, updateAccount } = require('../services/account-service');

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
    return res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};

type UpdateValidatePayload = z.infer<typeof userSchema>;

export const UpdateAccountHandler = async (
  req: TypedRequestBody<{ email: string; full_name: string }>,
  res: Response,
) => {
  try {
    const payload: UpdateValidatePayload = req.body;
    userSchema.parse(payload);

    const { email, full_name: fullName } = req.body;

    await updateAccount(req.user.userId, req.user.secret, email, fullName);
    return res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};

type CreateValidatePayload = z.infer<typeof createAccountSchema>;

export const CreateAccountHandler = async (
  req: TypedRequestBody<{ userFullName: string }>,
  res: Response,
) => {
  try {
    const payload: CreateValidatePayload = req.body;
    createAccountSchema.parse(payload);

    if (!req.auth || !req.auth?.payload.sub) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json();
    }
    const user = await createAccount(
      req.auth.token,
      req.auth.payload.sub,
      req.body.userFullName,
    );

    return res.status(StatusCodes.CREATED).json({ body: user });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};
