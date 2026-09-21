import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 🔥 LOGS SUPER DETALLADOS 🔥
    this.logger.error('═══════════════════════════════════════════════════════');
    this.logger.error('🚨 ERROR CAPTURADO POR GLOBAL EXCEPTION FILTER 🚨');
    this.logger.error('═══════════════════════════════════════════════════════');
    this.logger.error(`📍 URL: ${request.url}`);
    this.logger.error(`📍 Method: ${request.method}`);
    this.logger.error(`📍 Status Code: ${status}`);
    this.logger.error(`📍 Timestamp: ${new Date().toISOString()}`);
    this.logger.error('───────────────────────────────────────────────────────');
    this.logger.error(`🔴 Tipo de Excepción: ${exception?.constructor?.name || 'Unknown'}`);
    this.logger.error(`🔴 Mensaje: ${exception?.message || 'Sin mensaje'}`);
    this.logger.error('───────────────────────────────────────────────────────');
    
    // Stack trace completo
    if (exception?.stack) {
      this.logger.error('📚 STACK TRACE COMPLETO:');
      this.logger.error(exception.stack);
      this.logger.error('───────────────────────────────────────────────────────');
    } else {
      this.logger.error('⚠️ No hay stack trace disponible');
    }
    
    // Detalles completos del error
    try {
      const errorDetails = JSON.stringify(
        exception, 
        Object.getOwnPropertyNames(exception), 
        2
      );
      this.logger.error('📋 DETALLES COMPLETOS DEL ERROR:');
      this.logger.error(errorDetails);
      this.logger.error('───────────────────────────────────────────────────────');
    } catch (e) {
      this.logger.error('⚠️ No se pudo serializar la excepción completa');
    }
    
    // Response del error (para HttpExceptions)
    if (exception?.response) {
      this.logger.error('📨 RESPONSE DEL ERROR:');
      try {
        this.logger.error(JSON.stringify(exception.response, null, 2));
      } catch (e) {
        this.logger.error(exception.response);
      }
      this.logger.error('───────────────────────────────────────────────────────');
    }

    // Información adicional si es HttpException
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      this.logger.error('🔍 HTTP EXCEPTION RESPONSE:');
      this.logger.error(JSON.stringify(exceptionResponse, null, 2));
      this.logger.error('───────────────────────────────────────────────────────');
    }
    
    this.logger.error('═══════════════════════════════════════════════════════');

    // Extraer el mensaje útil para el cliente.
    // Para HttpException, getResponse() contiene el cuerpo real de la excepción.
    // El ValidationPipe genera { message: string[], error: string, statusCode: number }.
    // Las excepciones manuales (ej: BadRequestException("texto")) generan { message: "texto", ... }
    // o simplemente el string "texto" directamente.
    // exception.message (getter de Error) solo devuelve el statusText ("Bad Request"),
    // por eso se descarta en favor de getResponse().
    let clientMessage: string | string[];

    if (exception instanceof HttpException) {
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        // throw new BadRequestException("texto directo")
        clientMessage = responseBody;
      } else if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        // ValidationPipe y la mayoría de excepciones HTTP estructuradas
        // message puede ser string[] (ValidationPipe) o string (manual)
        clientMessage = (responseBody as { message: string | string[] }).message;
      } else {
        // Fallback: usar el mensaje base de la excepción
        clientMessage = exception.message;
      }
    } else {
      // Errores no HTTP (errores de BD, bugs, etc.): nunca exponer detalles internos
      clientMessage = 'Error interno del servidor.';
    }

    // Respuesta al cliente
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: clientMessage,
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception?.stack,
        details: exception instanceof HttpException ? exception.getResponse() : undefined,
      }),
    };

    response.status(status).json(errorResponse);
  }
}