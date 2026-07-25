import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let field: string | undefined = undefined;

    if (exceptionResponse) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = exceptionResponse.message || exceptionResponse.error || 'Internal server error';
        field = exceptionResponse.field;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Standard HTTP status code mapping from Volume 1
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        code = 'VALIDATION_ERROR';
        if (exceptionResponse && Array.isArray(exceptionResponse.message)) {
          message = exceptionResponse.message.join(', ');
        }
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
        code = 'INTERNAL_ERROR';
    }

    const requestId = (request.headers['x-request-id'] as string) || 
      Math.random().toString(36).substring(2, 10).toUpperCase();

    // Log the actual stack trace for internal failures
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[HttpExceptionFilter] [RequestID: ${requestId}] Unhandled Exception:`, exception);
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
