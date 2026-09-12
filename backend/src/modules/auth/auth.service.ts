import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RolEnCuenta, type Usuario, type UsuarioCuenta, type Cuenta } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type { ActualizarPerfilDto, RegistroDto } from './dto/login.dto';

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

interface JwtPayload {
  sub: string;
  email: string;
  cuentaActivaId: string;
  impersonating?: boolean;
}

type UsuarioConMembresias = Usuario & {
  membresias: (UsuarioCuenta & { cuenta: { id: string; nombre: string } })[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokensResponse> {
    const usuario = await this.cargarUsuarioConMembresias({ email });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (usuario.membresias.length === 0) {
      throw new UnauthorizedException('Tu usuario no tiene cuentas asignadas — pedile al ingeniero que te dé acceso');
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    // Cuenta default: la legacy cuenta_id si tiene membresía activa, sino la primera
    const cuentaInicial =
      usuario.membresias.find((m) => m.cuentaId === usuario.cuentaId) ?? usuario.membresias[0];

    return this.generarTokens(this.armarUsuarioActual(usuario, cuentaInicial.cuentaId));
  }

  async refresh(refreshToken: string): Promise<TokensResponse> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const usuario = await this.cargarUsuarioConMembresias({ id: payload.sub });
    if (!usuario || !usuario.activo) throw new UnauthorizedException('Usuario no encontrado');

    const membresia = usuario.membresias.find((m) => m.cuentaId === payload.cuentaActivaId);
    if (!membresia) throw new UnauthorizedException('Sin acceso a esa cuenta');

    return this.generarTokens(this.armarUsuarioActual(usuario, membresia.cuentaId));
  }

  /// Genera un par de tokens "modo impersonación" para un superadmin sobre una cuenta target.
  /// El superadmin pasa a ver el sistema EXACTAMENTE como lo ve el ingeniero principal
  /// de esa cuenta — su nombre, email, rol global, módulos permitidos, todo. Solo el id
  /// del JWT sigue siendo el superadmin (para que el audit trail sepa que fue una
  /// impersonación, no el cliente actuando).
  async impersonar(superadminId: string, cuentaTargetId: string): Promise<TokensResponse> {
    const superadmin = await this.prisma.usuario.findFirst({
      where: { id: superadminId, activo: true, rolGlobal: 'superadmin' },
    });
    if (!superadmin) throw new ForbiddenException('Solo el superadmin puede impersonar');

    const cuenta = await this.prisma.cuenta.findFirst({
      where: { id: cuentaTargetId, activo: true },
      select: { id: true, nombre: true },
    });
    if (!cuenta) throw new UnauthorizedException('Cuenta no encontrada o inactiva');

    // Buscamos un ingeniero de esa cuenta para "tomar prestada" su identidad.
    // Si no hay ingeniero, cualquier miembro activo sirve. Si no hay ninguno → error.
    const proxy = await this.elegirUsuarioProxyDeLaCuenta(cuenta.id);
    if (!proxy) throw new UnauthorizedException('La cuenta no tiene miembros activos para impersonar');

    const accessExpiresIn = (this.config.get<string>('jwt.accessExpiresIn') ?? '30m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = (this.config.get<string>('jwt.refreshExpiresIn') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const payload: JwtPayload = {
      sub: superadmin.id,
      email: superadmin.email,
      cuentaActivaId: cuenta.id,
      impersonating: true,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessExpiresIn });
    const refreshToken = await this.jwt.signAsync(payload, { expiresIn: refreshExpiresIn });

    const usuarioActual: UsuarioActual = {
      id: superadmin.id, // se mantiene el superadmin para audit
      email: proxy.usuario.email,
      nombre: proxy.usuario.nombre,
      rolGlobal: proxy.usuario.rolGlobal, // ej. 'ingeniero' → no entra a /admin
      rolPlataforma: null, // impersonación no hereda rol Harvest
      walletAddress: null, // impersonación no hereda wallet
      cuentaId: cuenta.id,
      rolEnCuentaActiva: proxy.rol,
      modulosPermitidos: proxy.modulosPermitidos,
      membresias: [{ cuentaId: cuenta.id, cuentaNombre: cuenta.nombre, rol: proxy.rol }],
      impersonating: true,
      impersonatingCuentaNombre: cuenta.nombre,
    };
    return { accessToken, refreshToken, usuario: usuarioActual };
  }

  /// Elige el "usuario proxy" para impersonar una cuenta: prefiere el primer ingeniero
  /// activo (orden de creación), o cualquier miembro activo si no hay ingenieros.
  async elegirUsuarioProxyDeLaCuenta(cuentaId: string) {
    const ingeniero = await this.prisma.usuarioCuenta.findFirst({
      where: { cuentaId, activo: true, rol: 'ingeniero', usuario: { activo: true } },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: { email: true, nombre: true, rolGlobal: true } } },
    });
    if (ingeniero) return ingeniero;
    return this.prisma.usuarioCuenta.findFirst({
      where: { cuentaId, activo: true, usuario: { activo: true } },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: { email: true, nombre: true, rolGlobal: true } } },
    });
  }

  async switchCuenta(usuarioId: string, nuevaCuentaId: string): Promise<TokensResponse> {
    const usuario = await this.cargarUsuarioConMembresias({ id: usuarioId });
    if (!usuario || !usuario.activo) throw new UnauthorizedException('Usuario no encontrado');

    const membresia = usuario.membresias.find((m) => m.cuentaId === nuevaCuentaId);
    if (!membresia) throw new ForbiddenException('No tenés acceso a esa cuenta');

    return this.generarTokens(this.armarUsuarioActual(usuario, nuevaCuentaId));
  }

  async registrar(dto: RegistroDto): Promise<TokensResponse> {
    const emailLower = dto.email.toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { email: emailLower } });
    if (existente) throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await this.generarHash(dto.password);
    const { usuarioId, cuentaId } = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.create({
        data: {
          nombre: dto.nombreCuenta,
          emailContacto: dto.emailContacto,
          telefono: dto.telefono,
        },
      });
      const u = await tx.usuario.create({
        data: {
          cuentaId: cuenta.id,
          email: emailLower,
          passwordHash,
          nombre: dto.nombre,
          rolGlobal: 'ingeniero',
        },
      });
      await tx.usuarioCuenta.create({
        data: {
          usuarioId: u.id,
          cuentaId: cuenta.id,
          rol: RolEnCuenta.ingeniero,
        },
      });
      return { usuarioId: u.id, cuentaId: cuenta.id };
    });

    const usuario = await this.cargarUsuarioConMembresias({ id: usuarioId });
    if (!usuario) throw new UnauthorizedException('Registro falló');
    return this.generarTokens(this.armarUsuarioActual(usuario, cuentaId));
  }

  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto) {
    if (dto.email) {
      const existente = await this.prisma.usuario.findFirst({
        where: { email: dto.email.toLowerCase(), id: { not: usuarioId } },
      });
      if (existente) throw new ConflictException('Ya existe un usuario con ese email');
    }
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(dto.nombre && { nombre: dto.nombre }),
        ...(dto.email && { email: dto.email.toLowerCase() }),
      },
    });
    return {
      id: actualizado.id,
      email: actualizado.email,
      nombre: actualizado.nombre,
      cuentaId: actualizado.cuentaId,
    };
  }

  /// Activación de cuenta vía token de invitación.
  /// Valida que el token existe, no expiró y no fue usado. Setea la password,
  /// marca el token como usado y devuelve los tokens de sesión.
  async activarConToken(token: string, passwordNueva: string): Promise<TokensResponse> {
    const invitacion = await this.prisma.tokenInvitacion.findUnique({
      where: { token },
      include: { usuario: true },
    });
    if (!invitacion) throw new NotFoundException('Token de invitación no válido');
    if (invitacion.usadoEn) throw new GoneException('Este link ya fue usado');
    if (invitacion.expiraEn < new Date()) throw new GoneException('El link de invitación venció — pedile uno nuevo');
    if (!invitacion.usuario.activo) throw new ForbiddenException('Usuario desactivado');

    const passwordHash = await this.generarHash(passwordNueva);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: invitacion.usuarioId },
        data: { passwordHash, ultimoLogin: new Date() },
      }),
      this.prisma.tokenInvitacion.update({
        where: { id: invitacion.id },
        data: { usadoEn: new Date() },
      }),
    ]);

    const usuario = await this.cargarUsuarioConMembresias({ id: invitacion.usuarioId });
    if (!usuario || usuario.membresias.length === 0) {
      throw new UnauthorizedException('Usuario sin membresías');
    }
    return this.generarTokens(this.armarUsuarioActual(usuario, usuario.membresias[0].cuentaId));
  }

  /// Devuelve si un token de invitación sigue siendo válido (para que la UI muestre estado).
  async verificarTokenInvitacion(token: string): Promise<{ valido: boolean; motivo?: string; emailDestinatario?: string }> {
    const invitacion = await this.prisma.tokenInvitacion.findUnique({
      where: { token },
      include: { usuario: { select: { email: true, nombre: true, activo: true } } },
    });
    if (!invitacion) return { valido: false, motivo: 'no_existe' };
    if (invitacion.usadoEn) return { valido: false, motivo: 'usado' };
    if (invitacion.expiraEn < new Date()) return { valido: false, motivo: 'expirado' };
    if (!invitacion.usuario.activo) return { valido: false, motivo: 'usuario_inactivo' };
    return { valido: true, emailDestinatario: invitacion.usuario.email };
  }

  async cambiarPassword(usuarioId: string, passwordActual: string, passwordNueva: string): Promise<{ ok: true }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new BadRequestException('Usuario no encontrado');
    const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');
    const passwordHash = await this.generarHash(passwordNueva);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
    return { ok: true };
  }

  async generarHash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async cargarUsuarioConMembresias(
    where: { email: string } | { id: string },
  ): Promise<UsuarioConMembresias | null> {
    return this.prisma.usuario.findUnique({
      where: where as { email: string },
      include: {
        membresias: {
          where: { activo: true },
          include: { cuenta: { select: { id: true, nombre: true, activo: true } } },
        },
      },
    }) as Promise<UsuarioConMembresias | null>;
  }

  private armarUsuarioActual(usuario: UsuarioConMembresias, cuentaActivaId: string): UsuarioActual {
    const activa = usuario.membresias.find((m) => m.cuentaId === cuentaActivaId);
    if (!activa) throw new UnauthorizedException('Sin acceso a esa cuenta');
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rolGlobal: usuario.rolGlobal,
      rolPlataforma: usuario.rolPlataforma,
      walletAddress: usuario.walletAddress,
      cuentaId: activa.cuentaId,
      rolEnCuentaActiva: activa.rol,
      modulosPermitidos: activa.modulosPermitidos,
      membresias: usuario.membresias.map((m) => ({
        cuentaId: m.cuentaId,
        cuentaNombre: m.cuenta.nombre,
        rol: m.rol,
      })),
    };
  }

  private async generarTokens(usuario: UsuarioActual): Promise<TokensResponse> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      cuentaActivaId: usuario.cuentaId,
    };
    const accessExpiresIn = (this.config.get<string>('jwt.accessExpiresIn') ?? '30m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = (this.config.get<string>('jwt.refreshExpiresIn') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessExpiresIn });
    const refreshToken = await this.jwt.signAsync(payload, { expiresIn: refreshExpiresIn });
    return { accessToken, refreshToken, usuario };
  }
}
// type-import only re-exported to satisfy linter (Cuenta usado en type)
export type { Cuenta };
