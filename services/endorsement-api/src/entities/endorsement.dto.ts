import Joi from 'joi';
import type { InputDataType } from './template.entity';

export type FlatValue = string | number | boolean | null;

/** JSON plano de entrada. Además de la clave de plantilla, los campos los define cada plantilla. */
export type EndorsementRequestDto = Record<string, FlatValue> & {
  producto: string;
  tipoEndoso: string;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TranslationResultDto {
  document: JsonValue;
  template: {
    id: number;
    productCode: string;
    endorsementTypeCode: string;
    version: number;
  };
}

export interface MissingFieldDto {
  field: string;
  target: string;
}

export interface InvalidFieldDto {
  field: string;
  expected: string;
  received: FlatValue;
}

export interface TemplateInputDto {
  name: string;
  required: boolean;
  defaultValue: string | null;
  dataType: InputDataType;
}

export interface TemplateSummaryDto {
  productCode: string;
  endorsementTypeCode: string;
  version: number;
  inputs: TemplateInputDto[];
}

const templateKey = Joi.string().trim().min(1).max(100).required();

/**
 * Solo exige lo necesario para encontrar la plantilla y que el JSON sea plano.
 * Los demás campos obligatorios dependen de la plantilla y se validan al traducir.
 */
export const endorsementRequestSchema = Joi.object({
  producto: templateKey,
  tipoEndoso: templateKey,
})
  .pattern(
    Joi.string().max(100),
    Joi.alternatives()
      .try(Joi.string().allow('').max(1000), Joi.number(), Joi.boolean())
      .allow(null),
  )
  .max(100)
  .label('endoso');
