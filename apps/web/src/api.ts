export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: {
      missing?: { field: string; target: string }[];
      invalid?: { field: string; expected: string; received: unknown }[];
    },
  ) {
    super(message);
  }
}

interface ApiResponse<T> {
  data: T;
  headers: Headers;
}

export type InputDataType = 'string' | 'integer' | 'number' | 'boolean' | 'date';

export interface TemplateInput {
  name: string;
  required: boolean;
  defaultValue: string | null;
  dataType: InputDataType;
}

export interface TemplateSummary {
  productCode: string;
  endorsementTypeCode: string;
  version: number;
  inputs: TemplateInput[];
}

export interface OptimalRoute {
  fromDepot: string;
  to: string;
  path: string[];
  distance: number;
}

export type RoadGraph = Record<string, Record<string, number>>;

async function request<T>(
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servicio.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data ?? {}) as {
      code?: string;
      message?: string;
      details?: ApiError['details'];
    };
    throw new ApiError(
      response.status,
      error.code ?? 'HTTP_ERROR',
      error.message ?? `El servicio respondió ${response.status}.`,
      error.details,
    );
  }
  return { data: data as T, headers: response.headers };
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string; expiresIn: number }>('/api/v1/auth/login', {
      body: { username, password },
    }),
  templates: (token: string) =>
    request<{ templates: TemplateSummary[] }>('/api/v1/endorse/templates', { token }),
  translate: (token: string, body: unknown) =>
    request<unknown>('/api/v1/endorse/translate', { token, body }),
  optimalRoute: (
    token: string,
    body: { accidentLocation: string; depots: string[]; graph: RoadGraph },
  ) => request<OptimalRoute>('/api/v1/routes/optimal', { token, body }),
};
