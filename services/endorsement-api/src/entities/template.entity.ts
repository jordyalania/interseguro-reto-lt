import type { JsonValue } from './endorsement.dto';

/** Plantilla ya ordenada, lista para la lógica de negocio e independiente del ORM. */
export interface TemplateDefinition {
  id: number;
  productCode: string;
  endorsementTypeCode: string;
  version: number;
  skeleton: JsonValue;
  dynamicFields: DynamicFieldDefinition[];
  events: TemplateEventDefinition[];
}

export interface DynamicFieldDefinition {
  label: string;
  sourceField: string | null;
  defaultValue: string | null;
  required: boolean;
}

export interface TemplateEventDefinition {
  description: string;
  orderEvent: number;
}
