import {
  Body, CanActivate, Controller, createParamDecorator, ExecutionContext, ForbiddenException,
  Get, HttpCode, Injectable, Post, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { LoginDto } from './dto';

export const DEMO_CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';

export type Principal =
  | { sub: string; role: 'admin' }
  | { sub: string; role: 'customer'; customerId: string };

const accounts: Principal[] = [
  { sub: 'admin@example.test', role: 'admin' },
  { sub: 'customer@example.test', role: 'customer', customerId: DEMO_CUSTOMER_ID },
];
const passwordHash = scryptSync('portal-demo-2026', 'portal-lab-demo-salt', 32);

const roles = 'portal_roles';
export const Roles = (...allowed: Principal['role'][]) => SetMetadata(roles, allowed);
export const CurrentUser = createParamDecorator(
  (_data, context: ExecutionContext): Principal => context.switchToHttp().getRequest().user,
);

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login({ email, password }: LoginDto) {
    const account = accounts.find((candidate) => candidate.sub === email.toLowerCase());
    const matches = timingSafeEqual(passwordHash, scryptSync(password, 'portal-lab-demo-salt', 32));
    if (!account || !matches) throw new UnauthorizedException('Invalid credentials');
    return { accessToken: await this.jwt.signAsync(account), role: account.role };
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer token required');
    let principal: Principal;
    try {
      principal = await this.jwt.verifyAsync<Principal>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const allowed = this.reflector.getAllAndOverride<Principal['role'][]>(roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && !allowed.includes(principal.role)) throw new ForbiddenException();
    request.user = principal;
    return true;
  }
}

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: Principal) {
    return user;
  }
}
