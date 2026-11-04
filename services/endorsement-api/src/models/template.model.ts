import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { JsonValue } from '../entities/endorsement.dto';
import { EndorsementTypeModel } from './endorsement-type.model';
import { ProductModel } from './product.model';

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

@Entity('templates')
export class TemplateModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductModel, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: ProductModel;

  @ManyToOne(() => EndorsementTypeModel, { nullable: false })
  @JoinColumn({ name: 'endorsement_type_id' })
  endorsementType: EndorsementTypeModel;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 20 })
  status: TemplateStatus;

  // `json` y no `jsonb`: jsonb reordena las claves y el core exige un orden.
  @Column({ name: 'output_skeleton', type: 'json' })
  outputSkeleton: JsonValue;

  @OneToMany(() => TemplateDynamicFieldModel, (field) => field.template)
  dynamicFields: TemplateDynamicFieldModel[];

  @OneToMany(() => TemplateEventModel, (event) => event.template)
  events: TemplateEventModel[];
}

@Entity('template_dynamic_fields')
export class TemplateDynamicFieldModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemplateModel, (template) => template.dynamicFields, { nullable: false })
  @JoinColumn({ name: 'template_id' })
  template: TemplateModel;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ name: 'source_field', type: 'varchar', length: 100, nullable: true })
  sourceField: string | null;

  @Column({ name: 'default_value', type: 'text', nullable: true })
  defaultValue: string | null;

  @Column({ type: 'boolean' })
  required: boolean;
}

@Entity('template_events')
export class TemplateEventModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemplateModel, (template) => template.events, { nullable: false })
  @JoinColumn({ name: 'template_id' })
  template: TemplateModel;

  @Column({ name: 'order_event', type: 'int' })
  orderEvent: number;

  @Column({ type: 'varchar', length: 100 })
  description: string;
}
