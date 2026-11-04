import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('endorsement_types')
export class EndorsementTypeModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;
}
