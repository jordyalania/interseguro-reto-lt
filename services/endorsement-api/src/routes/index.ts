import type { ServerRoute } from '@hapi/hapi';
import type { AuthController } from '../controllers/auth.controller';
import type { EndorsementController } from '../controllers/endorsement.controller';
import { loginRequestSchema } from '../entities/auth.dto';
import { endorsementRequestSchema } from '../entities/endorsement.dto';

const API_V1 = '/api/v1';

export function buildRoutes(
  endorsements: EndorsementController,
  auth: AuthController,
): ServerRoute[] {
  return [
    {
      method: 'GET',
      path: '/health',
      options: {
        auth: false,
        plugins: { 'hapi-pino': { logRequestComplete: false } } as never,
        handler: () => ({ status: 'ok' }),
      },
    },
    {
      method: 'POST',
      path: `${API_V1}/auth/login`,
      options: {
        auth: false,
        tags: ['api', 'auth'],
        description: 'Obtiene un JWT RS256 de corta duración',
        validate: { payload: loginRequestSchema },
        handler: auth.login,
      },
    },
    {
      method: 'POST',
      path: `${API_V1}/endorse/translate`,
      options: {
        tags: ['api', 'endorsements'],
        description: 'Traduce un JSON plano al JSON estructurado del core',
        notes: 'La plantilla se elige por producto y tipoEndoso, y define la estructura de salida.',
        validate: { payload: endorsementRequestSchema },
        handler: endorsements.translate,
      },
    },
    {
      method: 'GET',
      path: `${API_V1}/endorse/templates`,
      options: {
        tags: ['api', 'endorsements'],
        description: 'Lista las plantillas activas y los campos que aceptan',
        handler: endorsements.listTemplates,
      },
    },
  ];
}
