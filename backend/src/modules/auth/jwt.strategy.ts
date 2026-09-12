import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';

interface JwtPayload {
  sub: string;       // user id
  email: string;
  cuentaId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) throw new Error('JWT_SECRET no configurado');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioActual> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: payload.sub, activo: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado o inactivo');

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      cuentaId: usuario.cuentaId,
    };
  }
}
