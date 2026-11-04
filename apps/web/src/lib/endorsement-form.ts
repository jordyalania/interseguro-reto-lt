import type { InputDataType, TemplateInput } from '../api';

export type FlatValue = string | number | boolean | null;
export type FlatPayload = Record<string, FlatValue>;

export const PDF_EXAMPLE: FlatPayload = {
  policyNumber: '08200000049',
  idEnvio: 5984,
  frecuencia: 'Semestral',
  tipoEndoso: 'CambioFrecuencia',
  producto: 'Rumbo',
  plan: 'PlanRumbo',
  moneda: 'Nuevo Sol',
  usuario: 'interface.servicios',
  fechaSolicitud: '2025-08-27',
  fechaCliente: '2025-08-27',
  fechaEfectiva: '2025-09-01',
};

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const TEXT_CHECKS: Record<InputDataType, { isValid: (value: string) => boolean; message: string }> = {
  string: { isValid: () => true, message: '' },
  integer: {
    isValid: (value) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)),
    message: 'Debe ser un número entero.',
  },
  number: {
    isValid: (value) => /^-?\d+(\.\d+)?$/.test(value),
    message: 'Debe ser un número.',
  },
  boolean: {
    isValid: (value) => value === 'true' || value === 'false',
    message: 'Debe ser true o false.',
  },
  date: {
    isValid: isRealDate,
    message: 'Debe ser una fecha real con formato AAAA-MM-DD.',
  },
};

/**
 * Da respuesta inmediata con las reglas que define la plantilla.
 * El control definitivo lo hace la API, también para quien no use este formulario.
 */
export function validateForm(
  inputs: TemplateInput[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { name, required, defaultValue, dataType } of inputs) {
    const value = values[name] ?? '';
    if (value === '') {
      if (required && defaultValue === null) {
        errors[name] = 'Este campo es obligatorio.';
      }
      continue;
    }
    const check = TEXT_CHECKS[dataType];
    if (!check.isValid(value)) {
      errors[name] = check.message;
    }
  }
  return errors;
}

function toTypedValue(value: string, dataType: InputDataType): FlatValue {
  if (!TEXT_CHECKS[dataType].isValid(value)) {
    return value;
  }
  if (dataType === 'integer' || dataType === 'number') return Number(value);
  if (dataType === 'boolean') return value === 'true';
  return value;
}

/**
 * Convierte el formulario en el JSON de entrada, con el tipo que define la plantilla.
 * Un campo vacío se omite para que el backend aplique su default.
 */
export function buildPayload(
  product: string,
  endorsementType: string,
  values: Record<string, string>,
  inputs: TemplateInput[],
): FlatPayload {
  const payload: FlatPayload = { producto: product, tipoEndoso: endorsementType };
  for (const [name, value] of Object.entries(values)) {
    if (value === '' || name === 'producto' || name === 'tipoEndoso') {
      continue;
    }
    const dataType = inputs.find((input) => input.name === name)?.dataType ?? 'string';
    payload[name] = toTypedValue(value, dataType);
  }
  return payload;
}

/** Valida el texto del editor JSON y devuelve el objeto o un mensaje de error. */
export function parseJsonPayload(text: string): { payload: FlatPayload } | { error: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { error: 'El JSON debe ser un objeto.' };
    }
    return { payload: parsed as FlatPayload };
  } catch (error) {
    return { error: `JSON inválido: ${(error as Error).message}` };
  }
}
