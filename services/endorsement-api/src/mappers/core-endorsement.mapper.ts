import type {
  FlatValue,
  JsonValue,
  MissingFieldDto,
  TemplateInputDto,
} from '../entities/endorsement.dto';
import type { DynamicFieldDefinition, TemplateDefinition } from '../entities/template.entity';
import { TemplateConfigurationError } from '../errors/app-error';

type Input = Record<string, FlatValue>;
type JsonObject = { [key: string]: JsonValue };

export interface MappingResult {
  document: JsonValue;
  missing: MissingFieldDto[];
}

function isObject(node: JsonValue): node is JsonObject {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

function isDirective(node: JsonObject): boolean {
  return Object.keys(node).some((key) => key.startsWith('$'));
}

/** Valida una directiva `$input` y devuelve sus partes. */
function parseInputDirective(node: JsonObject, path: string): { field: string; fallback?: string } {
  const field = node.$input;
  const fallback = node.$default;
  const hasOnlyKnownKeys = Object.keys(node).every((key) => key === '$input' || key === '$default');
  const validDefault = fallback === undefined || typeof fallback === 'string';

  if (typeof field !== 'string' || !hasOnlyKnownKeys || !validDefault) {
    throw new TemplateConfigurationError(`Directiva $input inválida en "${path}"`);
  }
  return fallback === undefined ? { field } : { field, fallback: fallback as string };
}

function resolveDynamicField(
  field: DynamicFieldDefinition,
  input: Input,
  missing: MissingFieldDto[],
): FlatValue {
  if (field.sourceField === null) {
    return field.defaultValue;
  }

  const target = `dynamicData.${field.label}`;
  // Un campo ausente, null o "" son casos distintos: el default solo cubre el ausente.
  if (!Object.hasOwn(input, field.sourceField)) {
    if (field.defaultValue !== null) {
      return field.defaultValue;
    }
    if (field.required) {
      missing.push({ field: field.sourceField, target });
    }
    return null;
  }

  const value = input[field.sourceField] ?? null;
  if (value === null && field.required) {
    missing.push({ field: field.sourceField, target });
  }
  return value;
}

/**
 * Construye el JSON del core recorriendo el esqueleto de la plantilla.
 * El código no conoce ningún producto: toda la estructura proviene de la configuración.
 */
export function buildCoreEndorsement(template: TemplateDefinition, input: Input): MappingResult {
  const missing: MissingFieldDto[] = [];

  const resolveDirective = (node: JsonObject, path: string): JsonValue => {
    if ('$input' in node) {
      const { field, fallback } = parseInputDirective(node, path);
      if (!Object.hasOwn(input, field) && fallback !== undefined) {
        return fallback;
      }
      const value = Object.hasOwn(input, field) ? (input[field] ?? null) : null;
      if (value === null) {
        missing.push({ field, target: path });
      }
      return value;
    }
    if (node.$dynamicData === true) {
      return template.dynamicFields.map((field) => ({
        etiqueta: field.label,
        value: resolveDynamicField(field, input, missing),
      }));
    }
    if (node.$eventAppliedEntities === true) {
      return template.events.map(({ description, orderEvent }) => ({ description, orderEvent }));
    }
    if (node.$primaryEvent === true) {
      const primary = template.events[0];
      if (!primary) {
        throw new TemplateConfigurationError(`La plantilla ${template.id} no tiene eventos`);
      }
      return primary.description;
    }
    throw new TemplateConfigurationError(`Directiva desconocida en "${path}"`);
  };

  const visit = (node: JsonValue, path: string): JsonValue => {
    if (Array.isArray(node)) {
      return node.map((item, index) => visit(item, `${path}[${index}]`));
    }
    if (!isObject(node)) {
      return node;
    }
    if (isDirective(node)) {
      return resolveDirective(node, path);
    }
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = visit(value, path ? `${path}.${key}` : key);
    }
    return result;
  };

  const document = visit(template.skeleton, '');
  return { document, missing };
}

/** Lista los campos que acepta una plantilla, para construir formularios dinámicos. */
export function describeTemplateInputs(template: TemplateDefinition): TemplateInputDto[] {
  const inputs = new Map<string, TemplateInputDto>();

  const add = (name: string, required: boolean, defaultValue: string | null): void => {
    const current = inputs.get(name);
    inputs.set(name, {
      name,
      required: required || (current?.required ?? false),
      defaultValue: current?.defaultValue ?? defaultValue,
    });
  };

  const visit = (node: JsonValue, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (isObject(node)) {
      if ('$input' in node) {
        const { field, fallback } = parseInputDirective(node, path);
        add(field, fallback === undefined, fallback ?? null);
      } else if (!isDirective(node)) {
        Object.entries(node).forEach(([key, value]) => visit(value, `${path}.${key}`));
      }
    }
  };

  visit(template.skeleton, '');
  for (const field of template.dynamicFields) {
    if (field.sourceField !== null) {
      add(field.sourceField, field.required && field.defaultValue === null, field.defaultValue);
    }
  }
  return [...inputs.values()];
}
