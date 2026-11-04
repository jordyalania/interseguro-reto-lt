import * as Boom from '@hapi/boom';

export const ErrorCode = {
  Validation: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  TemplateNotFound: 'TEMPLATE_NOT_FOUND',
  MissingRequiredFields: 'MISSING_REQUIRED_FIELDS',
  InvalidFieldValues: 'INVALID_FIELD_VALUES',
  TemplateMisconfigured: 'TEMPLATE_MISCONFIGURED',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Crea un error HTTP con el formato uniforme de la API. */
export function appError(
  statusCode: number,
  code: ErrorCodeValue,
  message: string,
  details?: unknown,
): Boom.Boom {
  const error = new Boom.Boom(message, { statusCode });
  const payload = error.output.payload as unknown as Record<string, unknown>;
  payload.message = message;
  payload.code = code;
  if (details !== undefined) {
    payload.details = details;
  }
  return error;
}

/** Una plantilla guardada en BD no se puede interpretar: es un fallo de configuración, no del cliente. */
export class TemplateConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateConfigurationError';
  }
}
