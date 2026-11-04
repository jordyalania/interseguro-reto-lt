import { createHash, timingSafeEqual } from 'node:crypto';
import Jwt from '@hapi/jwt';
import type { AppConfig } from '../config/env';
import type { LoginRequestDto, LoginResponseDto } from '../entities/auth.dto';
import { appError, ErrorCode } from '../errors/app-error';

function sameSecret(a: string, b: string): boolean {
  // Comparar resúmenes de igual longitud evita filtrar información por tiempo de respuesta.
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export class AuthService {
  constructor(
    private readonly jwt: AppConfig['jwt'],
    private readonly demoUser: AppConfig['demoUser'],
  ) {}

  login({ username, password }: LoginRequestDto): LoginResponseDto {
    const validUser = sameSecret(username, this.demoUser.username);
    const validPassword = sameSecret(password, this.demoUser.password);
    if (!validUser || !validPassword) {
      throw appError(401, ErrorCode.InvalidCredentials, 'Usuario o contraseña incorrectos');
    }

    const accessToken = Jwt.token.generate(
      { sub: username, iss: this.jwt.issuer, aud: this.jwt.audience },
      { key: this.jwt.privateKey, algorithm: 'RS256' },
      { ttlSec: this.jwt.ttlSeconds },
    );

    return { accessToken, tokenType: 'Bearer', expiresIn: this.jwt.ttlSeconds };
  }
}
