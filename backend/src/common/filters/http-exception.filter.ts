import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { isProductionRuntime } from '../config/env.validation';

function looksLikeInternalLeak(text: string): boolean {
  return /at\s+\S+\s+\(|[A-Za-z]:\\|\/home\/|\/var\/|node_modules|firestore\.googleapis|\.ts:\d+|stack trace|ECONNREFUSED|private_key|BEGIN PRIVATE/i.test(
    text,
  );
}

function toClientMessage(raw: unknown, status: number): string {
  if (status >= 500) {
    return 'An unexpected error occurred';
  }
  let message = 'Request could not be completed';
  if (typeof raw === 'string') {
    message = raw;
  } else if (Array.isArray(raw)) {
    message = raw.map(String).join(', ');
  } else if (raw != null) {
    message = String(raw);
  }
  if (looksLikeInternalLeak(message)) {
    return 'Request could not be completed';
  }
  return message;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException ? exception.getResponse() : null;

    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let field: string | undefined;

    if (exceptionResponse) {
      if (typeof exceptionResponse === 'string') {
        message = toClientMessage(exceptionResponse, status);
      } else {
        const rawMsg = exceptionResponse.message ?? exceptionResponse.error;
        message = toClientMessage(rawMsg, status);
        field = exceptionResponse.field;
      }
    } else if (status < 500) {
      message = toClientMessage(
        exception instanceof Error ? exception.message : 'Request could not be completed',
        status,
      );
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        code = 'VALIDATION_ERROR';
        break;
      case HttpStatus.UNAUTHORIZED:
        code = 'UNAUTHENTICATED';
        break;
      case HttpStatus.FORBIDDEN:
        code = 'FORBIDDEN';
        break;
      case HttpStatus.NOT_FOUND:
        code = 'NOT_FOUND';
        break;
      case HttpStatus.CONFLICT:
        code = 'CONFLICT';
        break;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        code = 'UNPROCESSABLE';
        break;
      case HttpStatus.TOO_MANY_REQUESTS:
        code = 'RATE_LIMITED';
        break;
      default:
        if (status >= 500) {
          code = 'INTERNAL_ERROR';
          message = 'An unexpected error occurred';
        }
    }

    const requestId =
      (request.headers['x-request-id'] as string) ||
      Math.random().toString(36).substring(2, 10).toUpperCase();

    // Detailed errors — server logs only (never sent to client).
    if (status >= 500) {
      const detail =
        exception instanceof Error
          ? `${exception.message}\n${exception.stack ?? ''}`
          : String(exception);
      console.error(`[HttpExceptionFilter] [correlationId=${requestId}]`, detail);
    } else if (isProductionRuntime()) {
      console.warn(
        `[HttpExceptionFilter] [correlationId=${requestId}] ${status} ${code}`,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        field,
        request_id: requestId,
      },
    });
  }
}
