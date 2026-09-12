import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
  cuentaId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokensResponse> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { cuenta: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (usuario.cuenta && !usuario.cuenta.activo) {
      throw new UnauthorizedException('Cuenta inactiva');
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    return this.generarTokens({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      cuentaId: usuario.cuentaId,
    });
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

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: payload.sub, activo: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    return this.generarTokens({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      cuentaId: usuario.cuentaId,
    });
  }

  async registrar(dto: RegistroDto): Promise<TokensResponse> {
    const emailLower = dto.email.toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { email: emailLower } });
    if (existente) throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await this.generarHash(dto.password);
    const usuario = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.create({
        data: {
          nombre: dto.nombreCuenta,
          emailContacto: dto.emailContacto,
          telefono: dto.telefono,
        },
      });
      return tx.usuario.create({
        data: {
          cuentaId: cuenta.id,
          email: emailLower,
          passwordHash,
          nombre: dto.nombre,
        },
      });
    });

    return this.generarTokens({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      cuentaId: usuario.cuentaId,
    });
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

  private async generarTokens(usuario: UsuarioActual): Promise<TokensResponse> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      cuentaId: usuario.cuentaId,
    };
    const accessExpiresIn = (this.config.get<string>('jwt.accessExpiresIn') ?? '30m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = (this.config.get<string>('jwt.refreshExpiresIn') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessExpiresIn });
    const refreshToken = await this.jwt.signAsync(payload, { expiresIn: refreshExpiresIn });
    return { accessToken, refreshToken, usuario };
  }
}
