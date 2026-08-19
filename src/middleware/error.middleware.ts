/**
 * Centralized Error Middleware — Standardized Error Handling
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.context?.requestId || 'req_unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Handle unexpected system errors
  console.error(`[Error] Unhandled error (${requestId}):`, err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
      requestId,
    },
  });
}
