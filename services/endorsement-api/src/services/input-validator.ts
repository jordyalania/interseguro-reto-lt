import type { FlatValue, InvalidFieldDto } from '../entities/endorsement.dto';
import type { InputDataType, InputRuleDefinition } from '../entities/template.entity';

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  // El objeto Date corrige fechas como el 30 de febrero, así que se compara el resultado.
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const CHECKS: Record<InputDataType, { expected: string; isValid: (value: FlatValue) => boolean }> = {
  string: { expected: 'texto', isValid: (value) => typeof value === 'string' },
  integer: { expected: 'número entero', isValid: (value) => Number.isSafeInteger(value) },
  number: { expected: 'número', isValid: (value) => typeof value === 'number' },
  boolean: { expected: 'verdadero o falso', isValid: (value) => typeof value === 'boolean' },
  date: {
    expected: 'fecha real con formato AAAA-MM-DD',
    isValid: (value) => typeof value === 'string' && isRealDate(value),
  },
};

/** Revisa los campos enviados. Los ausentes y los null los maneja la regla de obligatoriedad. */
export function validateInputValues(
  rules: InputRuleDefinition[],
  input: Record<string, FlatValue>,
): InvalidFieldDto[] {
  return rules.flatMap(({ field, dataType }) => {
    if (!Object.hasOwn(input, field) || input[field] === null) {
      return [];
    }
    const { expected, isValid } = CHECKS[dataType];
    return isValid(input[field]!) ? [] : [{ field, expected, received: input[field]! }];
  });
}
