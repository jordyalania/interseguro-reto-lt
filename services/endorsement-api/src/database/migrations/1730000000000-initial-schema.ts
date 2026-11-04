import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL
      );

      CREATE TABLE endorsement_types (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL
      );

      CREATE TABLE templates (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL REFERENCES products (id),
        endorsement_type_id INT NOT NULL REFERENCES endorsement_types (id),
        version INT NOT NULL CHECK (version > 0),
        status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
        output_skeleton JSON NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (product_id, endorsement_type_id, version)
      );

      -- Garantiza una sola versión activa por producto y tipo de endoso.
      CREATE UNIQUE INDEX templates_one_active_per_key
        ON templates (product_id, endorsement_type_id)
        WHERE status = 'ACTIVE';

      CREATE TABLE template_dynamic_fields (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
        sort_order INT NOT NULL CHECK (sort_order > 0),
        label VARCHAR(100) NOT NULL,
        source_field VARCHAR(100),
        default_value TEXT,
        required BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE (template_id, sort_order),
        UNIQUE (template_id, label),
        -- Un campo sin origen ni default nunca podría producir un valor.
        CONSTRAINT field_has_value_source
          CHECK (source_field IS NOT NULL OR default_value IS NOT NULL)
      );

      CREATE TABLE template_events (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
        order_event INT NOT NULL CHECK (order_event > 0),
        description VARCHAR(100) NOT NULL,
        UNIQUE (template_id, order_event)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE template_events;
      DROP TABLE template_dynamic_fields;
      DROP TABLE templates;
      DROP TABLE endorsement_types;
      DROP TABLE products;
    `);
  }
}
