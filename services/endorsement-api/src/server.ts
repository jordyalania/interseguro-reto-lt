import * as Boom from '@hapi/boom';
import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Jwt from '@hapi/jwt';
import Vision from '@hapi/vision';
import HapiPino from 'hapi-pino';
import HapiSwagger from 'hapi-swagger';
import type { AppConfig } from './config/env';
import { AuthController } from './controllers/auth.controller';
import { EndorsementController } from './controllers/endorsement.controller';
import { appError, ErrorCode } from './errors/app-error';
import type { TemplateRepository } from './repositories/template.repository';
import { buildRoutes } from './routes';
import { AuthService } from './services/auth.service';
import { TranslationService } from './services/translation.service';

export interface ServerDependencies {
  config: AppConfig;
  templateRepository: TemplateRepository;
}

const MAX_PAYLOAD_BYTES = 64 * 1024;

const CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCode.Validation,
  401: ErrorCode.Unauthorized,
  500: ErrorCode.Internal,
};

export async function createServer({ config, templateRepository }: ServerDependencies) {
  const server = Hapi.server({
    port: config.port,
    host: '0.0.0.0',
    routes: {
      security: true,
      payload: { maxBytes: MAX_PAYLOAD_BYTES },
      validate: {
        options: { abortEarly: false },
        failAction: (_request, _h, error) => {
          throw appError(400, ErrorCode.Validation, error?.message ?? 'Solicitud inválida');
        },
      },
    },
  });

  if (config.logging) {
    await server.register({
      plugin: HapiPino,
      options: {
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        getChildBindings: (request) => ({ requestId: request.headers['x-request-id'] }),
      },
    });
  }

  await server.register(Jwt);
  server.auth.strategy('jwt', 'jwt', {
    keys: { key: config.jwt.publicKey, algorithms: ['RS256'] },
    verify: {
      aud: config.jwt.audience,
      iss: config.jwt.issuer,
      sub: false,
      nbf: true,
      exp: true,
      timeSkewSec: 15,
    },
    validate: (artifacts: { decoded: { payload: { sub: string } } }) => ({
      isValid: true,
      credentials: { sub: artifacts.decoded.payload.sub },
    }),
  });
  // Toda ruta exige token salvo que declare lo contrario de forma explícita.
  server.auth.default('jwt');

  if (config.docs) {
    await server.register([
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: {
          auth: false,
          info: { title: 'API traductora de endosos', version: '1.0.0' },
          grouping: 'tags',
          securityDefinitions: {
            jwt: { type: 'apiKey', name: 'Authorization', in: 'header' },
          },
          security: [{ jwt: [] }],
        },
      },
    ]);
  }

  // Todos los errores salen con el mismo formato: statusCode, error, message, code y details.
  server.ext('onPreResponse', (request, h) => {
    const { response } = request;
    if (!Boom.isBoom(response)) {
      return h.continue;
    }
    const payload = response.output.payload as unknown as Record<string, unknown>;
    payload.code ??= CODE_BY_STATUS[response.output.statusCode] ?? 'HTTP_ERROR';
    if (response.output.statusCode >= 500) {
      request.log(['error'], { err: response.message });
    }
    return h.continue;
  });

  const translation = new TranslationService(templateRepository);
  const auth = new AuthService(config.jwt, config.demoUser);
  server.route(
    buildRoutes(new EndorsementController(translation), new AuthController(auth)),
  );

  return server;
}
