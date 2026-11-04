import type { TemplateDefinition } from '../entities/template.entity';
import type { TemplateModel } from '../models/template.model';

/** Convierte el modelo del ORM a la entidad de negocio y fija el orden definido en BD. */
export function toTemplateDefinition(model: TemplateModel): TemplateDefinition {
  return {
    id: model.id,
    productCode: model.product.code,
    endorsementTypeCode: model.endorsementType.code,
    version: model.version,
    skeleton: model.outputSkeleton,
    dynamicFields: [...model.dynamicFields]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ label, sourceField, defaultValue, required }) => ({
        label,
        sourceField,
        defaultValue,
        required,
      })),
    events: [...model.events]
      .sort((a, b) => a.orderEvent - b.orderEvent)
      .map(({ description, orderEvent }) => ({ description, orderEvent })),
  };
}
