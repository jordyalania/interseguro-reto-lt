import { generateKeyPairSync } from 'node:crypto';
import type { AppConfig } from '../src/config/env';
import type { EndorsementTypeModel } from '../src/models/endorsement-type.model';
import type { ProductModel } from '../src/models/product.model';
import type { TemplateModel } from '../src/models/template.model';
import type { TemplateRepository } from '../src/repositories/template.repository';

const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const testConfig: AppConfig = {
  port: 0,
  databaseUrl: 'postgres://unused',
  logging: false,
  docs: false,
  jwt: {
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    issuer: 'endorsement-api',
    audience: 'interseguro-reto',
    ttlSeconds: 900,
  },
  demoUser: { username: 'demo', password: 'secreto-de-prueba' },
};

export const pdfInput = {
  policyNumber: '08200000049',
  idEnvio: 5984,
  frecuencia: 'Semestral',
  tipoEndoso: 'CambioFrecuencia',
  producto: 'Rumbo',
  plan: 'PlanRumbo',
  moneda: 'Nuevo Sol',
  usuario: 'interface.servicios',
  fechaSolicitud: '2025-08-27',
  fechaCliente: '2025-08-27',
  fechaEfectiva: '2025-09-01',
};

export const pdfOutput = {
  policyNumber: '08200000049',
  idEnvio: 5984,
  financialPlansEntity: { description: 'Semestral' },
  currency: { description: 'Nuevo Sol' },
  productEntity: { description: 'Rumbo' },
  eventEntity: {
    description: 'SolicitarEndoso',
    dynamicData: [
      { etiqueta: 'ProductosVida', value: 'Rumbo' },
      { etiqueta: 'NombreUsuario', value: 'interface.servicios' },
      { etiqueta: 'NumeroPolizaEndoso', value: '08200000049' },
      { etiqueta: 'TipoEndosoPol', value: 'Endoso Simple' },
      { etiqueta: 'ResponsableAtencion', value: 'SAC' },
      { etiqueta: 'EndosoModifPrima', value: 'Si' },
      { etiqueta: 'InicioVigenciaEndoso', value: 'Default' },
      { etiqueta: 'TipoVigenciaEndoso', value: '' },
      { etiqueta: 'EndososSimplesSACRumbo', value: 'TES008' },
      { etiqueta: 'FechaSolicitud', value: '2025-08-27' },
      { etiqueta: 'FechaCliente', value: '2025-08-27' },
      { etiqueta: 'FechaEfectiva', value: '2025-09-01' },
    ],
  },
  eventAppliedEntities: [
    { description: 'SolicitarEndoso', orderEvent: 1 },
    { description: 'AprobarEndoso', orderEvent: 2 },
  ],
  riskUnitEntities: [
    {
      insuranceObjectEntities: [
        {
          insuranceObjectNumber: '1',
          coverageEntities: [],
          participationEntities: [],
        },
      ],
      plansEntity: { description: 'PlanRumbo' },
      riskUnitNumber: '1',
    },
  ],
  participationEntities: [],
};

type FieldRow = [number, string, string | null, string | null, boolean];

const rumboFields: FieldRow[] = [
  [1, 'ProductosVida', 'producto', null, true],
  [2, 'NombreUsuario', 'usuario', 'sistema', false],
  [3, 'NumeroPolizaEndoso', 'policyNumber', null, true],
  [4, 'TipoEndosoPol', null, 'Endoso Simple', false],
  [5, 'ResponsableAtencion', null, 'SAC', false],
  [6, 'EndosoModifPrima', null, 'Si', false],
  [7, 'InicioVigenciaEndoso', null, 'Default', false],
  [8, 'TipoVigenciaEndoso', null, '', false],
  [9, 'EndososSimplesSACRumbo', null, 'TES008', false],
  [10, 'FechaSolicitud', 'fechaSolicitud', null, true],
  [11, 'FechaCliente', 'fechaCliente', null, true],
  [12, 'FechaEfectiva', 'fechaEfectiva', null, true],
];

/** Modelo en memoria, equivalente al seed. Se desordena a propósito para probar que el orden lo fija sort_order. */
export function rumboTemplateModel(): TemplateModel {
  return {
    id: 1,
    version: 1,
    status: 'ACTIVE',
    product: { id: 1, code: 'Rumbo', name: 'Rumbo' } as ProductModel,
    endorsementType: {
      id: 1,
      code: 'CambioFrecuencia',
      name: 'Cambio de frecuencia',
    } as EndorsementTypeModel,
    outputSkeleton: {
      policyNumber: { $input: 'policyNumber' },
      idEnvio: { $input: 'idEnvio' },
      financialPlansEntity: { description: { $input: 'frecuencia' } },
      currency: { description: { $input: 'moneda' } },
      productEntity: { description: { $input: 'producto' } },
      eventEntity: {
        description: { $primaryEvent: true },
        dynamicData: { $dynamicData: true },
      },
      eventAppliedEntities: { $eventAppliedEntities: true },
      riskUnitEntities: [
        {
          insuranceObjectEntities: [
            {
              insuranceObjectNumber: '1',
              coverageEntities: [],
              participationEntities: [],
            },
          ],
          plansEntity: { description: { $input: 'plan' } },
          riskUnitNumber: '1',
        },
      ],
      participationEntities: [],
    },
    dynamicFields: [...rumboFields]
      .reverse()
      .map(([sortOrder, label, sourceField, defaultValue, required], index) => ({
        id: index + 1,
        sortOrder,
        label,
        sourceField,
        defaultValue,
        required,
      })),
    events: [
      { id: 2, orderEvent: 2, description: 'AprobarEndoso' },
      { id: 1, orderEvent: 1, description: 'SolicitarEndoso' },
    ],
  } as unknown as TemplateModel;
}

export function fakeRepository(models: TemplateModel[] = [rumboTemplateModel()]): TemplateRepository {
  return {
    findActive: async (product, type) =>
      models.find((m) => m.product.code === product && m.endorsementType.code === type) ?? null,
    listActive: async () => models,
  };
}
