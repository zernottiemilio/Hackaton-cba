import { Injectable, UnauthorizedException, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: string;             // user id
  email: string;
  cuentaActivaId: string;  // cuenta seleccionada en este token
  /** Si está presente, el superadmin está impersonando esta cuenta. */
  impersonating?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuthService)) private readonly auth: AuthService,
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
      include: {
        membresias: {
          where: { activo: true },
          include: { cuenta: { select: { id: true, nombre: true } } },
        },
      },
    });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado o inactivo');

    // --- Modo impersonación: solo válido para superadmins.
    // El UsuarioActual devuelto refleja al "usuario proxy" de la cuenta target
    // (su nombre, email, rol, módulos) — así el panel del cliente se ve idéntico
    // a como lo ve el cliente real. El JWT.sub queda como superadmin para audit.
    if (payload.impersonating) {
      if (usuario.rolGlobal !== 'superadmin') {
        throw new UnauthorizedException('Impersonación no permitida');
      }
      const cuentaTarget = await this.prisma.cuenta.findFirst({
        where: { id: payload.cuentaActivaId, activo: true },
        select: { id: true, nombre: true },
      });
      if (!cuentaTarget) throw new UnauthorizedException('Cuenta a impersonar no encontrada');

      const proxy = await this.auth.elegirUsuarioProxyDeLaCuenta(cuentaTarget.id);
      if (!proxy) throw new UnauthorizedException('La cuenta a impersonar no tiene miembros activos');

      return {
        id: usuario.id, // superadmin — para audit
        email: proxy.usuario.email,
        nombre: proxy.usuario.nombre,
        rolGlobal: proxy.usuario.rolGlobal,
        rolPlataforma: null, // impersonación no hereda rol Harvest
        walletAddress: null,
        cuentaId: cuentaTarget.id,
        rolEnCuentaActiva: proxy.rol,
        modulosPermitidos: proxy.modulosPermitidos,
        membresias: [{ cuentaId: cuentaTarget.id, cuentaNombre: cuentaTarget.nombre, rol: proxy.rol }],
        impersonating: true,
        impersonatingCuentaNombre: cuentaTarget.nombre,
      };
    }

    if (usuario.membresias.length === 0) {
      throw new UnauthorizedException('Usuario sin membresías activas');
    }

    const membresiaActiva = usuario.membresias.find((m) => m.cuentaId === payload.cuentaActivaId);
    if (!membresiaActiva) {
      throw new UnauthorizedException('Sin acceso a esa cuenta');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rolGlobal: usuario.rolGlobal,
      rolPlataforma: usuario.rolPlataforma,
      walletAddress: usuario.walletAddress,
      cuentaId: membresiaActiva.cuentaId,
      rolEnCuentaActiva: membresiaActiva.rol,
      modulosPermitidos: membresiaActiva.modulosPermitidos,
      membresias: usuario.membresias.map((m) => ({
        cuentaId: m.cuentaId,
        cuentaNombre: m.cuenta.nombre,
        rol: m.rol,
      })),
    };
  }
}
