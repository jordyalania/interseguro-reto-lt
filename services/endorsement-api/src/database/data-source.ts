import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { EndorsementTypeModel } from '../models/endorsement-type.model';
import { ProductModel } from '../models/product.model';
import {
  TemplateDynamicFieldModel,
  TemplateEventModel,
  TemplateModel,
} from '../models/template.model';
import { InitialSchema1730000000000 } from './migrations/1730000000000-initial-schema';

export function createDataSource(databaseUrl: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      ProductModel,
      EndorsementTypeModel,
      TemplateModel,
      TemplateDynamicFieldModel,
      TemplateEventModel,
    ],
    migrations: [InitialSchema1730000000000],
    synchronize: false,
    logging: false,
    extra: { max: 5 },
  });
}
