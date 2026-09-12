import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { InvitarUsuarioDto } from './dto/admin.dto';

const INVITACION_TTL_DIAS = 7;

@Injectable()
export class UsuariosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async listar() {
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        membresias: {
          where: { activo: true },
          include: { cuenta: { select: { id: true, nombre: true } } },
        },
        invitaciones: {
          where: { usadoEn: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rolGlobal: u.rolGlobal,
      activo: u.activo,
      ultimoLogin: u.ultimoLogin,
      createdAt: u.createdAt,
      cuentas: u.membresias.map((m) => ({ id: m.cuenta.id, nombre: m.cuenta.nombre, rol: m.rol })),
      pendienteActivacion: u.ultimoLogin === null && u.invitaciones.length > 0,
    }));
  }

  /// Invita a un usuario a una cuenta existente. Si el email ya existe globalmente,
  /// solo le agregamos la membresía. Si es nuevo, lo creamos con hash sentinela + token.
  async invitar(dto: InvitarUsuarioDto) {
    const cuenta = await this.prisma.cuenta.findUnique({ where: { id: dto.cuentaId } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: { membresias: { where: { cuentaId: dto.cuentaId } } },
    });

    if (existente && existente.membresias.length > 0) {
      throw new ConflictException('Ese usuario ya pertenece a la cuenta');
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      let usuario = existente;
      let necesitaActivacion = false;

      if (!usuario) {
        const sentinelHash = await generarHashSentinela();
        usuario = await tx.usuario.create({
          data: {
            cuentaId: dto.cuentaId,
            email: dto.email,
            passwordHash: sentinelHash,
            nombre: dto.nombre,
            rolGlobal: dto.rol === 'propietario' ? 'propietario' : 'ingeniero',
            activo: true,
          },
          include: { membresias: { where: { cuentaId: dto.cuentaId } } },
        });
        necesitaActivacion = true;
      }

      await tx.usuarioCuenta.create({
        data: { usuarioId: usuario.id, cuentaId: dto.cuentaId, rol: dto.rol },
      });

      let token: string | null = null;
      if (necesitaActivacion) {
        token = generarToken();
        await tx.tokenInvitacion.create({
          data: {
            usuarioId: usuario.id,
            token,
            expiraEn: addDias(new Date(), INVITACION_TTL_DIAS),
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
        cuentaNombre: cuenta.nombre,
        linkActivacion: link,
      });
    }

    return {
      usuarioId: resultado.usuario.id,
      necesitaActivacion: resultado.necesitaActivacion,
      invitacionEnviada: !!resultado.token,
    };
  }

  /// Regenera el token de invitación y reenvía el email.
  async reenviarInvitacion(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        membresias: { where: { activo: true }, include: { cuenta: true }, take: 1 },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.ultimoLogin) {
      throw new ConflictException('El usuario ya activó su cuenta');
    }
    const cuenta = usuario.membresias[0]?.cuenta;
    if (!cuenta) throw new NotFoundException('El usuario no tiene cuenta asignada');

    const token = generarToken();
    await this.prisma.$transaction(async (tx) => {
      // Invalidamos cualquier token pendiente previo marcándolos como usados.
      await tx.tokenInvitacion.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      });
      await tx.tokenInvitacion.create({
        data: { usuarioId, token, expiraEn: addDias(new Date(), INVITACION_TTL_DIAS) },
      });
    });

    const link = `${this.config.get<string>('appPublicUrl')}/activar/${token}`;
    await this.email.enviarInvitacion({
      to: usuario.email,
      nombre: usuario.nombre,
      cuentaNombre: cuenta.nombre,
      linkActivacion: link,
    });

    return { ok: true };
  }

  async activar(usuarioId: string) {
    const u = await this.prisma.usuario.update({ where: { id: usuarioId }, data: { activo: true } }).catch(() => null);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return { id: u.id, activo: u.activo };
  }

  async desactivar(usuarioId: string) {
    const u = await this.prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } }).catch(() => null);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return { id: u.id, activo: u.activo };
  }

  /// Actualiza datos básicos del usuario. Si cambia el email, valida unicidad.
  /// Bloquea el caso "superadmin bajándose el rol a sí mismo" — si pasa, se queda
  /// fuera del panel sin manera de volver.
  async actualizar(
    usuarioId: string,
    solicitanteId: string,
    dto: { nombre?: string; email?: string; rolGlobal?: 'superadmin' | 'ingeniero' | 'propietario' },
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== usuario.email) {
      const existente = await this.prisma.usuario.findFirst({ where: { email: dto.email, id: { not: usuarioId } } });
      if (existente) throw new ConflictException('Ya existe un usuario con ese email');
    }

    if (
      usuarioId === solicitanteId &&
      dto.rolGlobal !== undefined &&
      dto.rolGlobal !== 'superadmin' &&
      usuario.rolGlobal === 'superadmin'
    ) {
      throw new ConflictException('No podés cambiar tu propio rol global');
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.rolGlobal !== undefined && { rolGlobal: dto.rolGlobal }),
      },
    });
    return {
      id: actualizado.id,
      email: actualizado.email,
      nombre: actualizado.nombre,
      rolGlobal: actualizado.rolGlobal,
      activo: actualizado.activo,
    };
  }

  /// Cambia el rol de una membresía (ingeniero / propietario / operador en una cuenta puntual).
  async actualizarMembresia(usuarioId: string, cuentaId: string, rol: 'ingeniero' | 'propietario' | 'operador') {
    const membresia = await this.prisma.usuarioCuenta.findUnique({
      where: { usuarioId_cuentaId: { usuarioId, cuentaId } },
    });
    if (!membresia) throw new NotFoundException('Membresía no encontrada');
    const actualizado = await this.prisma.usuarioCuenta.update({
      where: { id: membresia.id },
      data: { rol },
    });
    return { id: actualizado.id, rol: actualizado.rol };
  }

  /// Hard-delete del usuario. Borra todos los registros que tenía cargados
  /// (conversaciones, monitoreos, reportes, comentarios, alertas) y al final
  /// el usuario. Operación irreversible. No se puede borrar a uno mismo.
  async eliminar(usuarioId: string, solicitanteId: string) {
    if (usuarioId === solicitanteId) {
      throw new ConflictException('No podés eliminar tu propio usuario');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.$transaction(async (tx) => {
      // Comentarios del usuario sobre reportes ajenos (cascade no aplica acá).
      await tx.comentarioReporte.deleteMany({ where: { autorId: usuarioId } });
      // Reportes del usuario → cascadea sus propios comentarios.
      await tx.reporte.deleteMany({ where: { autorId: usuarioId } });
      // Monitoreos del usuario → cascadea sus fotos.
      await tx.monitoreo.deleteMany({ where: { autorId: usuarioId } });
      // Conversaciones del usuario → cascadea mensajes.
      await tx.conversacion.deleteMany({ where: { usuarioId } });
      // Alertas: la FK es opcional → nullify para no perder el historial.
      await tx.alerta.updateMany({ where: { usuarioId }, data: { usuarioId: null } });
      // Por último el usuario — cascadea UsuarioCuenta y TokenInvitacion.
      await tx.usuario.delete({ where: { id: usuarioId } });
    });
    return { ok: true };
  }

  /// Quita la membresía de un usuario en una cuenta (soft-delete activo=false).
  /// No borra al usuario — sólo le saca el acceso a esa cuenta.
  async quitarMembresia(usuarioId: string, cuentaId: string) {
    const membresia = await this.prisma.usuarioCuenta.findUnique({
      where: { usuarioId_cuentaId: { usuarioId, cuentaId } },
    });
    if (!membresia) throw new NotFoundException('Membresía no encontrada');
    await this.prisma.usuarioCuenta.update({
      where: { id: membresia.id },
      data: { activo: false },
    });
    return { ok: true };
  }
}

async function generarHashSentinela(): Promise<string> {
  const noise = crypto.randomBytes(48).toString('hex');
  return bcrypt.hash(noise, 12);
}

function generarToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function addDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}
