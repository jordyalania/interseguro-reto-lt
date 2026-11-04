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

/**
 * Convierte los valores del formulario en el JSON de entrada.
 * Un campo vacío se omite para que el backend aplique el default de la plantilla.
 * Solo `idEnvio` se envía como número: `policyNumber` debe conservar sus ceros iniciales.
 */
export function buildPayload(
  product: string,
  endorsementType: string,
  values: Record<string, string>,
): FlatPayload {
  const payload: FlatPayload = { producto: product, tipoEndoso: endorsementType };
  for (const [name, value] of Object.entries(values)) {
    if (value === '' || name === 'producto' || name === 'tipoEndoso') {
      continue;
    }
    const isNumeric = typeof PDF_EXAMPLE[name] === 'number' && /^-?\d+(\.\d+)?$/.test(value);
    payload[name] = isNumeric ? Number(value) : value;
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
