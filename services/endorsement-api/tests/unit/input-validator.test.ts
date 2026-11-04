import { describe, expect, it } from 'vitest';
import type { InputDataType } from '../../src/entities/template.entity';
import { validateInputValues } from '../../src/services/input-validator';

const check = (dataType: InputDataType, value: string | number | boolean | null) =>
  validateInputValues([{ field: 'campo', dataType }], { campo: value });

describe('validateInputValues', () => {
  it.each(['2025-08-27', '2024-02-29'])('acepta la fecha %s', (value) => {
    expect(check('date', value)).toEqual([]);
  });

  it.each([
    '12-18-2024',
    '18/12/2024',
    '2025-8-27',
    '2025-02-30',
    '2025-02-29',
    '2025-13-01',
    '',
    'mañana',
  ])('rechaza la fecha "%s"', (value) => {
    expect(check('date', value)).toEqual([
      { field: 'campo', expected: 'fecha real con formato AAAA-MM-DD', received: value },
    ]);
  });

  it('rechaza una fecha enviada como número', () => {
    expect(check('date', 20250827)).toHaveLength(1);
  });

  it.each([
    ['integer', 5984, true],
    ['integer', 0, true],
    ['integer', 1.5, false],
    ['integer', '5984', false],
    ['number', 1.5, true],
    ['number', '1.5', false],
    ['boolean', false, true],
    ['boolean', 'false', false],
    ['string', '', true],
    ['string', 8200000049, false],
  ] as const)('%s con %s: válido = %s', (dataType, value, valid) => {
    expect(check(dataType, value).length === 0).toBe(valid);
  });

  it('no revisa los campos ausentes ni los null', () => {
    const rules = [{ field: 'campo', dataType: 'date' as const }];

    expect(validateInputValues(rules, {})).toEqual([]);
    expect(validateInputValues(rules, { campo: null })).toEqual([]);
  });

  it('no confunde propiedades heredadas de Object con campos enviados', () => {
    expect(validateInputValues([{ field: 'constructor', dataType: 'date' }], {})).toEqual([]);
  });

  it('reporta todos los campos inválidos', () => {
    const invalid = validateInputValues(
      [
        { field: 'a', dataType: 'date' },
        { field: 'b', dataType: 'integer' },
      ],
      { a: 'x', b: 'y' },
    );

    expect(invalid.map((item) => item.field)).toEqual(['a', 'b']);
  });
});
