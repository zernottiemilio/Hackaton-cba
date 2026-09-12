import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioActual } from '../types/usuario-actual';
import { IS_SUPERADMIN_KEY } from '../decorators/super-admin.decorator';

/// Guard que protege endpoints reservados al superadmin de la plataforma.
/// Se usa siempre EN COMBINACIÓN con JwtAuthGuard (que ya corre global).
/// Si el handler/controller no está marcado con @SuperAdmin(), deja pasar.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiere = this.reflector.getAllAndOverride<boolean>(IS_SUPERADMIN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requiere) return true;

    const usuario = ctx.switchToHttp().getRequest().user as UsuarioActual | undefined;
    if (!usuario || usuario.rolGlobal !== 'superadmin') {
      throw new ForbiddenException('Acceso reservado al superadmin');
    }
    return true;
  }
}
