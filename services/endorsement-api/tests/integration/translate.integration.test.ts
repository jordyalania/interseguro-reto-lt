import type { Server } from '@hapi/hapi';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataSource } from '../../src/database/data-source';
import { migrateAndSeed } from '../../src/database/migrate';
import { TypeOrmTemplateRepository } from '../../src/repositories/template.repository';
import { createServer } from '../../src/server';
import { pdfInput, pdfOutput, testConfig } from '../fixtures';

describe('traducción contra PostgreSQL real', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let server: Server;
  let token: string;

  const translate = (payload: object) =>
    server.inject({
      method: 'POST',
      url: '/api/v1/endorse/translate',
      payload,
      headers: { authorization: `Bearer ${token}` },
    });

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    dataSource = createDataSource(container.getConnectionUri());
    await dataSource.initialize();
    await migrateAndSeed(dataSource);

    server = await createServer({
      config: testConfig,
      templateRepository: new TypeOrmTemplateRepository(dataSource),
    });
    await server.initialize();
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: testConfig.demoUser,
    });
    token = (login.result as { accessToken: string }).accessToken;
  }, 120_000);

  afterAll(async () => {
    await server?.stop();
    await dataSource?.destroy();
    await container?.stop();
  });

  it('reproduce la salida del PDF usando la plantilla guardada en BD', async () => {
    const response = await translate(pdfInput);

    expect(response.statusCode).toBe(200);
    expect(response.payload).toBe(JSON.stringify(pdfOutput));
  });

  it('volver a ejecutar migraciones y seeds no duplica datos', async () => {
    await migrateAndSeed(dataSource);

    const [{ total }] = await dataSource.query('SELECT count(*)::int AS total FROM template_dynamic_fields');
    expect(total).toBe(12);
  });

  it('admite un producto nuevo solo con SQL, sin cambiar código', async () => {
    const before = await translate({ producto: 'VidaAhorro', tipoEndoso: 'CambioMoneda' });
    expect(before.statusCode).toBe(404);

    const sql = await readFile(
      path.resolve(__dirname, '../../database/examples/add_product_vida_cambio_moneda.sql'),
      'utf8',
    );
    await dataSource.query(sql);

    const after = await translate({
      producto: 'VidaAhorro',
      tipoEndoso: 'CambioMoneda',
      policyNumber: '0859834',
      monedaActual: 'Nuevo Sol',
      monedaNueva: 'Dólar',
    });

    expect(after.statusCode).toBe(200);
    expect(after.payload).toBe(
      JSON.stringify({
        policyNumber: '0859834',
        currency: { description: 'Dólar' },
        productEntity: { description: 'Vida Ahorro' },
        eventEntity: {
          description: 'SolicitarCambioMoneda',
          dynamicData: [
            { etiqueta: 'NumeroPolizaEndoso', value: '0859834' },
            { etiqueta: 'MonedaAnterior', value: 'Nuevo Sol' },
            { etiqueta: 'MonedaNueva', value: 'Dólar' },
            { etiqueta: 'CanalAtencion', value: 'Digital' },
          ],
        },
        eventAppliedEntities: [
          { description: 'SolicitarCambioMoneda', orderEvent: 1 },
          { description: 'ValidarTipoCambio', orderEvent: 2 },
          { description: 'AprobarEndoso', orderEvent: 3 },
        ],
      }),
    );
  });

  it('una versión nueva reemplaza a la anterior al activarse', async () => {
    await dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE templates SET status = 'RETIRED' WHERE id = 1`);
      await manager.query(`
        INSERT INTO templates (product_id, endorsement_type_id, version, status, output_skeleton)
        SELECT product_id, endorsement_type_id, 2, 'ACTIVE', '{"versionNueva": {"$input": "policyNumber"}}'::json
        FROM templates WHERE id = 1
      `);
    });

    const response = await translate(pdfInput);

    expect(response.headers['x-template-version']).toBe('2');
    expect(response.payload).toBe(JSON.stringify({ versionNueva: pdfInput.policyNumber }));
  });

  it('la BD impide dos versiones activas para la misma clave', async () => {
    await expect(
      dataSource.query(`
        INSERT INTO templates (product_id, endorsement_type_id, version, status, output_skeleton)
        SELECT product_id, endorsement_type_id, 99, 'ACTIVE', '{}'::json
        FROM templates WHERE status = 'ACTIVE' LIMIT 1
      `),
    ).rejects.toThrow(/templates_one_active_per_key/);
  });

  it('la BD impide un campo sin origen ni default', async () => {
    await expect(
      dataSource.query(`
        INSERT INTO template_dynamic_fields (template_id, sort_order, label, required)
        VALUES (1, 99, 'SinValor', TRUE)
      `),
    ).rejects.toThrow(/field_has_value_source/);
  });
});
