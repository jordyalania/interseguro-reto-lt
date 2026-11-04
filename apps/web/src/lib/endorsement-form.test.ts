import { describe, expect, it } from 'vitest';
import type { InputDataType, TemplateInput } from '../api';
import { buildPayload, parseJsonPayload, validateForm } from './endorsement-form';

const input = (
  name: string,
  dataType: InputDataType = 'string',
  required = true,
  defaultValue: string | null = null,
): TemplateInput => ({ name, dataType, required, defaultValue });

const INPUTS = [
  input('policyNumber'),
  input('idEnvio', 'integer'),
  input('usuario', 'string', false, 'sistema'),
];

describe('buildPayload', () => {
  it('conserva los ceros iniciales del texto y envía los enteros como número', () => {
    const payload = buildPayload(
      'Rumbo',
      'CambioFrecuencia',
      { policyNumber: '08200000049', idEnvio: '5984' },
      INPUTS,
    );

    expect(payload).toEqual({
      producto: 'Rumbo',
      tipoEndoso: 'CambioFrecuencia',
      policyNumber: '08200000049',
      idEnvio: 5984,
    });
  });

  it('omite los campos vacíos para que se apliquen los defaults', () => {
    expect(buildPayload('Rumbo', 'CambioFrecuencia', { usuario: '' }, INPUTS)).not.toHaveProperty(
      'usuario',
    );
  });

  it('no permite que el formulario cambie la plantilla seleccionada', () => {
    const payload = buildPayload('Rumbo', 'CambioFrecuencia', { producto: 'Otro' }, INPUTS);

    expect(payload.producto).toBe('Rumbo');
  });

  it('deja un valor inválido como texto para que la API lo rechace', () => {
    const payload = buildPayload('Rumbo', 'CambioFrecuencia', { idEnvio: 'abc' }, INPUTS);

    expect(payload.idEnvio).toBe('abc');
  });

  it('convierte booleanos', () => {
    const payload = buildPayload('A', 'B', { activo: 'false' }, [input('activo', 'boolean')]);

    expect(payload.activo).toBe(false);
  });
});

describe('validateForm', () => {
  it('rechaza la fecha del caso reportado', () => {
    const errors = validateForm([input('fechaCliente', 'date')], { fechaCliente: '12-18-2024' });

    expect(errors.fechaCliente).toMatch(/AAAA-MM-DD/);
  });

  it.each(['2025-02-30', '18/12/2024', '2025-13-01'])('rechaza la fecha %s', (value) => {
    expect(validateForm([input('fecha', 'date')], { fecha: value })).toHaveProperty('fecha');
  });

  it('acepta una fecha real', () => {
    expect(validateForm([input('fecha', 'date')], { fecha: '2024-02-29' })).toEqual({});
  });

  it('exige los campos obligatorios sin default', () => {
    expect(validateForm(INPUTS, {}).policyNumber).toMatch(/obligatorio/);
  });

  it('permite dejar vacío un campo con default', () => {
    expect(validateForm(INPUTS, {})).not.toHaveProperty('usuario');
  });

  it('rechaza un entero con letras o decimales', () => {
    expect(validateForm(INPUTS, { idEnvio: '12a' })).toHaveProperty('idEnvio');
    expect(validateForm(INPUTS, { idEnvio: '1.5' })).toHaveProperty('idEnvio');
  });

  it('no valida el formato de un campo de texto', () => {
    const errors = validateForm(INPUTS, { policyNumber: 'cualquiera', idEnvio: '1' });

    expect(errors).toEqual({});
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
