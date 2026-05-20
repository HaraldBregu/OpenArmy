import { JsonObject } from "../types.js";

export class OpenArmyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: JsonObject,
  ) {
    super(message);
    this.name = "OpenArmyError";
  }
}

export function notFound(resource: string, id: string): OpenArmyError {
  return new OpenArmyError("NOT_FOUND", `${resource} not found: ${id}`, 404);
}

export function conflict(message: string): OpenArmyError {
  return new OpenArmyError("CONFLICT", message, 409);
}

export function forbidden(message: string): OpenArmyError {
  return new OpenArmyError("FORBIDDEN", message, 403);
}

export function validationError(message: string, details?: JsonObject): OpenArmyError {
  return new OpenArmyError("VALIDATION_ERROR", message, 422, details);
}

export function internalError(message: string, details?: JsonObject): OpenArmyError {
  return new OpenArmyError("INTERNAL_ERROR", message, 500, details);
}

export function toErrorPayload(error: unknown): {
  code: string;
  message: string;
  statusCode: number;
  details?: JsonObject;
} {
  if (error instanceof OpenArmyError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unknown runtime error",
    statusCode: 500,
  };
}
