import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolTokenizacion } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROL_PLATAFORMA_KEY } from '../decorators/rol-plataforma.decorator';
import type { UsuarioActual } from '../types/usuario-actual';

/**
 * Guard que valida el rolPlataforma del usuario contra los roles requeridos
 * por el endpoint (declarados con @RolPlataforma()).
 *
 * Corre DESPUÉS del JwtAuthGuard: asume `request.user` ya está poblado.
 */
@Injectable()
export class RolPlataformaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const rolesRequeridos = this.reflector.getAllAndOverride<RolTokenizacion[] | undefined>(
      ROL_PLATAFORMA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: UsuarioActual }>();
    const user = req.user;
    if (!user?.rolPlataforma) {
      throw new ForbiddenException(
        'Este endpoint requiere un rol de plataforma configurado (productor, inversor o admin).',
      );
    }
    if (!rolesRequeridos.includes(user.rolPlataforma)) {
      throw new ForbiddenException(
        `Requiere rol ${rolesRequeridos.join(' o ')}. Tu rol es ${user.rolPlataforma}.`,
      );
    }
    return true;
  }
}
