import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolEnCuenta, RolGlobal } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { ActualizarMiembroDto, InvitarMiembroDto } from './miembros.dto';

const INVITACION_TTL_DIAS = 7;

@Injectable()
export class MiembrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /// Sólo ingenieros (y por extensión propietarios si el ingeniero les dio el módulo "equipo")
  /// pueden invocar el resto. Definimos acá un único guard semántico.
  asegurarPuedeGestionar(rol: RolEnCuenta): void {
    if (rol !== RolEnCuenta.ingeniero) {
      throw new ForbiddenException('Sólo el ingeniero de la cuenta puede gestionar el equipo');
    }
  }

  async listar(cuentaId: string) {
    const membresias = await this.prisma.usuarioCuenta.findMany({
      where: { cuentaId, activo: true },
      include: {
        usuario: {
          select: {
            id: true, email: true, nombre: true, ultimoLogin: true, activo: true,
            invitaciones: { where: { usadoEn: null }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return membresias.map((m) => ({
      membresiaId: m.id,
      usuarioId: m.usuario.id,
      email: m.usuario.email,
      nombre: m.usuario.nombre,
      rol: m.rol,
      modulosPermitidos: m.modulosPermitidos,
      activo: m.usuario.activo && m.activo,
      ultimoLogin: m.usuario.ultimoLogin,
      creadoEn: m.createdAt,
      pendienteActivacion: m.usuario.ultimoLogin === null && m.usuario.invitaciones.length > 0,
    }));
  }

  async invitar(cuentaId: string, cuentaNombre: string, dto: InvitarMiembroDto) {
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: { membresias: { where: { cuentaId } } },
    });
    if (existente && existente.membresias.length > 0) {
      throw new ConflictException('Ese email ya pertenece a la cuenta');
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      let usuario = existente;
      let necesitaActivacion = false;

      if (!usuario) {
        const sentinelHash = await this.generarHashSentinela();
        usuario = await tx.usuario.create({
          data: {
            cuentaId,
            email: dto.email,
            passwordHash: sentinelHash,
            nombre: dto.nombre,
            rolGlobal: dto.rol === 'propietario' ? RolGlobal.propietario : RolGlobal.ingeniero,
            activo: true,
          },
          include: { membresias: { where: { cuentaId } } },
        });
        necesitaActivacion = true;
      }

      await tx.usuarioCuenta.create({
        data: {
          usuarioId: usuario.id,
          cuentaId,
          rol: dto.rol,
          modulosPermitidos: dto.modulosPermitidos,
        },
      });

      let token: string | null = null;
      if (necesitaActivacion) {
        token = this.generarToken();
        await tx.tokenInvitacion.create({
          data: {
            usuarioId: usuario.id,
            token,
            expiraEn: this.addDias(new Date(), INVITACION_TTL_DIAS),
          },
        });
      }

      return { usuario, token, necesitaActivacion };
    });

    if (resultado.token) {
      const link = `${this.config.get<string>('appPublicUrl')}/activar/${resultado.token}`;
      await this.email.enviarInvitacion({
        to: resultado.usuario.email,
        nombre: resultado.usuario.nombre,
        cuentaNombre,
        linkActivacion: link,
      });
    }

    return {
      usuarioId: resultado.usuario.id,
      necesitaActivacion: resultado.necesitaActivacion,
      invitacionEnviada: !!resultado.token,
    };
  }

  async actualizar(cuentaId: string, usuarioId: string, dto: ActualizarMiembroDto) {
    const membresia = await this.prisma.usuarioCuenta.findUnique({
      where: { usuarioId_cuentaId: { usuarioId, cuentaId } },
    });
    if (!membresia) throw new NotFoundException('Miembro no encontrado en esta cuenta');

    const data: { rol?: RolEnCuenta; modulosPermitidos?: string[] } = {};
    if (dto.rol !== undefined) data.rol = dto.rol;
    if (dto.modulosPermitidos !== undefined) data.modulosPermitidos = dto.modulosPermitidos;

    const actualizada = await this.prisma.usuarioCuenta.update({
      where: { id: membresia.id },
      data,
    });
    return {
      membresiaId: actualizada.id,
      rol: actualizada.rol,
      modulosPermitidos: actualizada.modulosPermitidos,
    };
  }

  async quitar(cuentaId: string, usuarioId: string, solicitanteId: string) {
    if (usuarioId === solicitanteId) {
      throw new ConflictException('No podés quitarte a vos mismo de la cuenta');
    }
    const membresia = await this.prisma.usuarioCuenta.findUnique({
      where: { usuarioId_cuentaId: { usuarioId, cuentaId } },
    });
    if (!membresia) throw new NotFoundException('Miembro no encontrado');
    await this.prisma.usuarioCuenta.update({
      where: { id: membresia.id },
      data: { activo: false },
    });
    return { ok: true };
  }

  async reenviarInvitacion(cuentaId: string, cuentaNombre: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { membresias: { where: { cuentaId, activo: true } } },
    });
    if (!usuario || usuario.membresias.length === 0) {
      throw new NotFoundException('Miembro no encontrado en esta cuenta');
    }
    if (usuario.ultimoLogin) {
      throw new ConflictException('El usuario ya activó su cuenta');
    }

    const token = this.generarToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenInvitacion.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      });
      await tx.tokenInvitacion.create({
        data: { usuarioId, token, expiraEn: this.addDias(new Date(), INVITACION_TTL_DIAS) },
      });
    });

    const link = `${this.config.get<string>('appPublicUrl')}/activar/${token}`;
    await this.email.enviarInvitacion({
      to: usuario.email,
      nombre: usuario.nombre,
      cuentaNombre,
      linkActivacion: link,
    });
    return { ok: true };
  }

  private async generarHashSentinela(): Promise<string> {
    return bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12);
  }

  private generarToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private addDias(d: Date, dias: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + dias);
    return x;
  }
}
