import { NextFunction, Request, Response } from 'express';

async function notFoundHandler(_req: Request, res: Response, _next: NextFunction) {
  return res.status(404).json({
    error: 'Not Found',
  });
}

export { notFoundHandler };
