import type { DataSource, Repository } from 'typeorm';
import { TemplateModel } from '../models/template.model';

export interface TemplateRepository {
  findActive(productCode: string, endorsementTypeCode: string): Promise<TemplateModel | null>;
  listActive(): Promise<TemplateModel[]>;
}

const RELATIONS = {
  product: true,
  endorsementType: true,
  dynamicFields: true,
  events: true,
  inputRules: true,
} as const;

export class TypeOrmTemplateRepository implements TemplateRepository {
  private readonly templates: Repository<TemplateModel>;

  constructor(dataSource: DataSource) {
    this.templates = dataSource.getRepository(TemplateModel);
  }

  findActive(productCode: string, endorsementTypeCode: string): Promise<TemplateModel | null> {
    return this.templates.findOne({
      relations: RELATIONS,
      where: {
        status: 'ACTIVE',
        product: { code: productCode },
        endorsementType: { code: endorsementTypeCode },
      },
    });
  }

  listActive(): Promise<TemplateModel[]> {
    return this.templates.find({
      relations: RELATIONS,
      where: { status: 'ACTIVE' },
      order: { product: { code: 'ASC' }, endorsementType: { code: 'ASC' } },
    });
  }
}
