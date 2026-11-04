import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TemplateInputRules1730000000001 implements MigrationInterface {
  name = 'TemplateInputRules1730000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE template_input_rules (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
        field VARCHAR(100) NOT NULL,
        data_type VARCHAR(20) NOT NULL
          CHECK (data_type IN ('string', 'integer', 'number', 'boolean', 'date')),
        UNIQUE (template_id, field)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE template_input_rules;');
  }
}
