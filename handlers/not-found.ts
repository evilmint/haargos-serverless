import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

async function notFoundHandler(_req: Request, res: Response, _next: NextFunction) {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: 'Not Found',
  });
}

export { notFoundHandler };
