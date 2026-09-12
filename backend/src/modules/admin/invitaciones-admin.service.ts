import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvitacionesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /// Listado de invitaciones pendientes y recientes.
  /// Incluye usuario destinatario y la cuenta donde se va a unir.
  async listar() {
    const tokens = await this.prisma.tokenInvitacion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        usuario: {
          select: {
            id: true, email: true, nombre: true, ultimoLogin: true,
            membresias: {
              where: { activo: true },
              include: { cuenta: { select: { id: true, nombre: true } } },
              take: 1,
            },
          },
        },
      },
    });
    const ahora = new Date();
    return tokens.map((t) => ({
      id: t.id,
      token: t.token,
      createdAt: t.createdAt,
      expiraEn: t.expiraEn,
      usadoEn: t.usadoEn,
      estado: t.usadoEn
        ? 'usada'
        : t.expiraEn < ahora
        ? 'expirada'
        : 'pendiente',
      usuario: {
        id: t.usuario.id,
        email: t.usuario.email,
        nombre: t.usuario.nombre,
      },
      cuenta: t.usuario.membresias[0]?.cuenta ?? null,
    }));
  }

  /// Cancela una invitación pendiente marcándola como usada.
  async cancelar(id: string) {
    const t = await this.prisma.tokenInvitacion.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Invitación no encontrada');
    if (t.usadoEn) return { ok: true, yaUsada: true };
    await this.prisma.tokenInvitacion.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
    return { ok: true };
  }
}
