import { describe, expect, it } from 'vitest';
import { buildPayload, parseJsonPayload } from './endorsement-form';

describe('buildPayload', () => {
  it('conserva los ceros iniciales de policyNumber y envía idEnvio como número', () => {
    const payload = buildPayload('Rumbo', 'CambioFrecuencia', {
      policyNumber: '08200000049',
      idEnvio: '5984',
    });

    expect(payload).toEqual({
      producto: 'Rumbo',
      tipoEndoso: 'CambioFrecuencia',
      policyNumber: '08200000049',
      idEnvio: 5984,
    });
  });

  it('omite los campos vacíos para que se apliquen los defaults', () => {
    const payload = buildPayload('Rumbo', 'CambioFrecuencia', { usuario: '' });

    expect(payload).not.toHaveProperty('usuario');
  });

  it('no permite que el formulario cambie la plantilla seleccionada', () => {
    const payload = buildPayload('Rumbo', 'CambioFrecuencia', { producto: 'Otro' });

    expect(payload.producto).toBe('Rumbo');
  });
});

describe('parseJsonPayload', () => {
  it('acepta un objeto', () => {
    expect(parseJsonPayload('{"a":1}')).toEqual({ payload: { a: 1 } });
  });

  it.each(['[]', 'null', '3'])('rechaza %s', (text) => {
    expect(parseJsonPayload(text)).toHaveProperty('error');
  });

  it('rechaza JSON mal formado', () => {
    expect(parseJsonPayload('{')).toHaveProperty('error');
  });
});
