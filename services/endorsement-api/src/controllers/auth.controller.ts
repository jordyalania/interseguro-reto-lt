import type { Request } from '@hapi/hapi';
import type { LoginRequestDto } from '../entities/auth.dto';
import type { AuthService } from '../services/auth.service';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  login = (request: Request) => this.auth.login(request.payload as LoginRequestDto);
}
