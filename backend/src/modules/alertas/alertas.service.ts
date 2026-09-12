import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolEnCuenta } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type { CrearAlertaDto } from './alertas.dto';

@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista las alertas relevantes para el usuario actual:
   *  - Las dirigidas explícitamente a él (usuarioId = user.id)
   *  - Las que son para toda la cuenta (usuarioId IS NULL)
   */
  async listar(user: UsuarioActual, soloNoLeidas = false) {
    return this.prisma.alerta.findMany({
      where: {
        cuentaId: user.cuentaId,
        activo: true,
        OR: [{ usuarioId: null }, { usuarioId: user.id }],
        ...(soloNoLeidas && { leida: false }),
      },
      orderBy: [{ leida: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async contarNoLeidas(user: UsuarioActual) {
    return this.prisma.alerta.count({
      where: {
        cuentaId: user.cuentaId,
        activo: true,
        leida: false,
        OR: [{ usuarioId: null }, { usuarioId: user.id }],
      },
    });
  }

  async marcarLeida(user: UsuarioActual, id: string) {
    const a = await this.obtenerSiVisible(user, id);
    if (a.leida) return a;
    return this.prisma.alerta.update({
      where: { id },
      data: { leida: true },
    });
  }

  async marcarTodasLeidas(user: UsuarioActual) {
    const res = await this.prisma.alerta.updateMany({
      where: {
        cuentaId: user.cuentaId,
        activo: true,
        leida: false,
        OR: [{ usuarioId: null }, { usuarioId: user.id }],
      },
      data: { leida: true },
    });
    return { actualizadas: res.count };
  }

  async eliminar(user: UsuarioActual, id: string) {
    await this.obtenerSiVisible(user, id);
    // Solo el ingeniero u operador pueden eliminar globalmente. El propietario
    // se limita a marcar como leídas las suyas.
    if (user.rolEnCuentaActiva === RolEnCuenta.propietario) {
      throw new ForbiddenException('El propietario no puede borrar alertas');
    }
    await this.prisma.alerta.update({ where: { id }, data: { activo: false } });
  }

  async crear(user: UsuarioActual, dto: CrearAlertaDto) {
    if (user.rolEnCuentaActiva === RolEnCuenta.propietario) {
      throw new ForbiddenException('El propietario no puede crear alertas');
    }

    // Si dirigida a usuario, verificar que sea miembro de la cuenta.
    if (dto.usuarioId) {
      const m = await this.prisma.usuarioCuenta.findFirst({
        where: { usuarioId: dto.usuarioId, cuentaId: user.cuentaId, activo: true },
        select: { id: true },
      });
      if (!m) throw new NotFoundException('Usuario no pertenece a esta cuenta');
    }

    return this.prisma.alerta.create({
      data: {
        cuentaId: user.cuentaId,
        usuarioId: dto.usuarioId ?? null,
        tipo: dto.tipo,
        severidad: dto.severidad,
        titulo: dto.titulo.trim(),
        detalle: dto.detalle?.trim() || null,
        contexto: (dto.contexto ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  // ---------- HELPERS ----------

  private async obtenerSiVisible(user: UsuarioActual, id: string) {
    const a = await this.prisma.alerta.findFirst({
      where: {
        id,
        cuentaId: user.cuentaId,
        activo: true,
        OR: [{ usuarioId: null }, { usuarioId: user.id }],
      },
    });
    if (!a) throw new NotFoundException('Alerta no encontrada');
    return a;
  }
}
