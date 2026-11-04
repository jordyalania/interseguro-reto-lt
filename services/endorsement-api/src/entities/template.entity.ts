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
  inputRules: InputRuleDefinition[];
}

export type InputDataType = 'string' | 'integer' | 'number' | 'boolean' | 'date';

export interface InputRuleDefinition {
  field: string;
  dataType: InputDataType;
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
