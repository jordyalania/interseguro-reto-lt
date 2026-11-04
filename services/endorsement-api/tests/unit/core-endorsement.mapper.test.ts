import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../src/entities/template.entity';
import { TemplateConfigurationError } from '../../src/errors/app-error';
import {
  buildCoreEndorsement,
  describeTemplateInputs,
} from '../../src/mappers/core-endorsement.mapper';
import { toTemplateDefinition } from '../../src/mappers/template.mapper';
import { pdfInput, pdfOutput, rumboTemplateModel } from '../fixtures';

const rumbo = (): TemplateDefinition => toTemplateDefinition(rumboTemplateModel());

const valueOf = (document: unknown, label: string): unknown => {
  const { eventEntity } = document as {
    eventEntity: { dynamicData: { etiqueta: string; value: unknown }[] };
  };
  return eventEntity.dynamicData.find((item) => item.etiqueta === label)?.value;
};

describe('buildCoreEndorsement', () => {
  it('produce exactamente la salida del PDF, incluido el orden de las claves', () => {
    const { document, missing } = buildCoreEndorsement(rumbo(), pdfInput);

    expect(missing).toEqual([]);
    expect(JSON.stringify(document)).toBe(JSON.stringify(pdfOutput));
  });

  it('conserva el tipo de los valores y los ceros iniciales', () => {
    const { document } = buildCoreEndorsement(rumbo(), pdfInput);
    const result = document as { policyNumber: unknown; idEnvio: unknown };

    expect(result.policyNumber).toBe('08200000049');
    expect(result.idEnvio).toBe(5984);
  });

  it('aplica el default cuando el campo está ausente', () => {
    const { usuario: _omitted, ...input } = pdfInput;
    const { document, missing } = buildCoreEndorsement(rumbo(), input);

    expect(missing).toEqual([]);
    expect(valueOf(document, 'NombreUsuario')).toBe('sistema');
  });

  it('no aplica el default si el campo se envió vacío', () => {
    const { document } = buildCoreEndorsement(rumbo(), { ...pdfInput, usuario: '' });

    expect(valueOf(document, 'NombreUsuario')).toBe('');
  });

  it('no aplica el default si el campo se envió como null', () => {
    const { document } = buildCoreEndorsement(rumbo(), { ...pdfInput, usuario: null });

    expect(valueOf(document, 'NombreUsuario')).toBeNull();
  });

  it.each([0, false])('acepta %s como valor presente', (idEnvio) => {
    const { document, missing } = buildCoreEndorsement(rumbo(), { ...pdfInput, idEnvio });

    expect(missing).toEqual([]);
    expect((document as { idEnvio: unknown }).idEnvio).toBe(idEnvio);
  });

  it('reporta todos los campos faltantes de una sola vez', () => {
    const { missing } = buildCoreEndorsement(rumbo(), {
      producto: 'Rumbo',
      tipoEndoso: 'CambioFrecuencia',
    });

    expect(missing.map((item) => item.field)).toEqual(
      expect.arrayContaining(['policyNumber', 'idEnvio', 'frecuencia', 'moneda', 'plan', 'fechaEfectiva']),
    );
    expect(missing).toContainEqual({
      field: 'plan',
      target: 'riskUnitEntities[0].plansEntity.description',
    });
    expect(missing).toContainEqual({
      field: 'fechaEfectiva',
      target: 'dynamicData.FechaEfectiva',
    });
  });

  it('trata un campo obligatorio en null como faltante', () => {
    const { missing } = buildCoreEndorsement(rumbo(), { ...pdfInput, moneda: null });

    expect(missing).toEqual([{ field: 'moneda', target: 'currency.description' }]);
  });

  it('no confunde propiedades heredadas de Object con campos enviados', () => {
    const template: TemplateDefinition = {
      ...rumbo(),
      skeleton: { value: { $input: 'constructor' } },
    };

    expect(buildCoreEndorsement(template, {}).missing).toEqual([
      { field: 'constructor', target: 'value' },
    ]);
  });

  it('usa $default en el esqueleto cuando el campo está ausente', () => {
    const template: TemplateDefinition = {
      ...rumbo(),
      skeleton: { currency: { $input: 'moneda', $default: 'Nuevo Sol' } },
    };

    expect(buildCoreEndorsement(template, {}).document).toEqual({
      currency: 'Nuevo Sol',
    });
  });

  it('soporta otra estructura de salida sin cambiar código', () => {
    const template: TemplateDefinition = {
      ...rumbo(),
      skeleton: { wrapper: { nested: [{ policy: { $input: 'policyNumber' } }, 'literal', 3] } },
    };

    expect(buildCoreEndorsement(template, { policyNumber: 'X' }).document).toEqual({
      wrapper: { nested: [{ policy: 'X' }, 'literal', 3] },
    });
  });

  it.each([
    ['directiva desconocida', { $unknown: true }],
    ['$input con tipo inválido', { $input: 7 }],
    ['$input con claves extra', { $input: 'a', extra: 'b' }],
  ])('rechaza %s', (_name, skeleton) => {
    const template: TemplateDefinition = { ...rumbo(), skeleton };

    expect(() => buildCoreEndorsement(template, {})).toThrow(TemplateConfigurationError);
  });

  it('rechaza $primaryEvent si la plantilla no tiene eventos', () => {
    const template: TemplateDefinition = {
      ...rumbo(),
      events: [],
      skeleton: { description: { $primaryEvent: true } },
    };

    expect(() => buildCoreEndorsement(template, {})).toThrow(TemplateConfigurationError);
  });
});

describe('describeTemplateInputs', () => {
  it('lista cada campo una vez con su obligatoriedad y default', () => {
    const inputs = describeTemplateInputs(rumbo());

    expect(inputs.filter((input) => input.name === 'producto')).toHaveLength(1);
    expect(inputs).toContainEqual({
      name: 'usuario',
      required: false,
      defaultValue: 'sistema',
      dataType: 'string',
    });
    expect(inputs).toContainEqual({
      name: 'plan',
      required: true,
      defaultValue: null,
      dataType: 'string',
    });
    expect(inputs.find((input) => input.name === 'fechaCliente')?.dataType).toBe('date');
  });
});
