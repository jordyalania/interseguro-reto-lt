import type { Server } from '@hapi/hapi';
import Jwt from '@hapi/jwt';
import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../../src/server';
import { fakeRepository, pdfInput, pdfOutput, rumboTemplateModel, testConfig } from '../fixtures';

const TRANSLATE_URL = '/api/v1/endorse/translate';

describe('API de endosos', () => {
  let server: Server;
  let token: string;

  const translate = (payload: unknown, authorization = `Bearer ${token}`) =>
    server.inject({
      method: 'POST',
      url: TRANSLATE_URL,
      payload: payload as object,
      headers: { authorization },
    });

  beforeAll(async () => {
    server = await createServer({ config: testConfig, templateRepository: fakeRepository() });
    await server.initialize();
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: testConfig.demoUser,
    });
    token = (login.result as { accessToken: string }).accessToken;
  });

  afterAll(() => server.stop());

  describe('POST /api/v1/endorse/translate', () => {
    it('traduce el ejemplo del PDF y respeta el orden', async () => {
      const response = await translate(pdfInput);

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe(JSON.stringify(pdfOutput));
      expect(response.headers['x-template-version']).toBe('1');
    });

    it('devuelve 404 si no existe plantilla activa', async () => {
      const response = await translate({ ...pdfInput, producto: 'Inexistente' });

      expect(response.statusCode).toBe(404);
      expect(response.result).toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    });

    it('devuelve 422 con todos los campos faltantes', async () => {
      const response = await translate({ producto: 'Rumbo', tipoEndoso: 'CambioFrecuencia' });
      const body = response.result as { code: string; details: { missing: { field: string }[] } };

      expect(response.statusCode).toBe(422);
      expect(body.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(body.details.missing.map((item) => item.field)).toContain('policyNumber');
    });

    it('devuelve 422 con una fecha en otro formato, como la del ejemplo reportado', async () => {
      const response = await translate({ ...pdfInput, fechaCliente: '12-18-2024' });
      const body = response.result as {
        code: string;
        details: { invalid: { field: string; received: string }[] };
      };

      expect(response.statusCode).toBe(422);
      expect(body.code).toBe('INVALID_FIELD_VALUES');
      expect(body.details.invalid).toEqual([
        {
          field: 'fechaCliente',
          expected: 'fecha real con formato AAAA-MM-DD',
          received: '12-18-2024',
        },
      ]);
    });

    it('reporta juntos los valores inválidos y los campos faltantes', async () => {
      const { plan: _omitted, ...input } = pdfInput;
      const response = await translate({ ...input, idEnvio: 'abc' });
      const body = response.result as {
        details: { invalid: { field: string }[]; missing: { field: string }[] };
      };

      expect(response.statusCode).toBe(422);
      expect(body.details.invalid.map((item) => item.field)).toEqual(['idEnvio']);
      expect(body.details.missing.map((item) => item.field)).toEqual(['plan']);
    });

    it('devuelve 400 si faltan producto o tipoEndoso', async () => {
      const response = await translate({ policyNumber: '1' });

      expect(response.statusCode).toBe(400);
      expect(response.result).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('devuelve 400 si el JSON no es plano', async () => {
      const response = await translate({ ...pdfInput, plan: { nombre: 'PlanRumbo' } });

      expect(response.statusCode).toBe(400);
    });

    it('devuelve 413 si el cuerpo supera el límite', async () => {
      const response = await translate({ ...pdfInput, usuario: 'x'.repeat(70 * 1024) });

      expect(response.statusCode).toBe(413);
    });

    it('oculta los detalles si una plantilla está mal configurada', async () => {
      const broken = rumboTemplateModel();
      broken.outputSkeleton = { value: { $secret: 'interno' } };
      const brokenServer = await createServer({
        config: testConfig,
        templateRepository: fakeRepository([broken]),
      });

      const response = await brokenServer.inject({
        method: 'POST',
        url: TRANSLATE_URL,
        payload: pdfInput,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(500);
      expect(response.result).toMatchObject({ code: 'TEMPLATE_MISCONFIGURED' });
      expect(response.payload).not.toContain('secret');
    });
  });

  describe('seguridad', () => {
    it('rechaza una solicitud sin token', async () => {
      const response = await server.inject({ method: 'POST', url: TRANSLATE_URL, payload: pdfInput });

      expect(response.statusCode).toBe(401);
      expect(response.result).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('rechaza un token firmado con otra clave', async () => {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const forged = Jwt.token.generate(
        { sub: 'demo', iss: testConfig.jwt.issuer, aud: testConfig.jwt.audience },
        { key: privateKey, algorithm: 'RS256' },
      );

      expect((await translate(pdfInput, `Bearer ${forged}`)).statusCode).toBe(401);
    });

    it('rechaza un token HS256 firmado con la clave pública', async () => {
      const confused = Jwt.token.generate(
        { sub: 'demo', iss: testConfig.jwt.issuer, aud: testConfig.jwt.audience },
        { key: testConfig.jwt.publicKey, algorithm: 'HS256' },
      );

      expect((await translate(pdfInput, `Bearer ${confused}`)).statusCode).toBe(401);
    });

    it('rechaza un token vencido', async () => {
      const expired = Jwt.token.generate(
        {
          sub: 'demo',
          iss: testConfig.jwt.issuer,
          aud: testConfig.jwt.audience,
          iat: 1000,
          exp: 2000,
        },
        { key: testConfig.jwt.privateKey, algorithm: 'RS256' },
        { iat: false },
      );

      expect((await translate(pdfInput, `Bearer ${expired}`)).statusCode).toBe(401);
    });

    it('rechaza credenciales incorrectas', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'demo', password: 'incorrecta' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.result).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  it('GET /api/v1/endorse/templates describe las plantillas activas', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/endorse/templates',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = response.result as { templates: { productCode: string }[] };

    expect(response.statusCode).toBe(200);
    expect(body.templates[0]?.productCode).toBe('Rumbo');
  });

  it('GET /health responde sin autenticación', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });
});
