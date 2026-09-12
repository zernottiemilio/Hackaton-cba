import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar, type PaginationQuery } from '../../common/pagination';
import type { CrearEstablecimientoDto, ActualizarEstablecimientoDto } from './establecimientos.dto';

@Injectable()
export class EstablecimientosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string, q: PaginationQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.search && { nombre: { contains: q.search, mode: 'insensitive' as const } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.establecimiento.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { lotes: { where: { activo: true } } } } },
      }),
      this.prisma.establecimiento.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.establecimiento.findFirst({
      where: { id, cuentaId },
      include: { lotes: { where: { activo: true }, orderBy: { nombre: 'asc' } } },
    });
    if (!item) throw new NotFoundException(`Establecimiento ${id} no encontrado`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearEstablecimientoDto) {
    return this.prisma.establecimiento.create({
      data: { ...dto, cuentaId },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarEstablecimientoDto) {
    await this.obtenerPorId(cuentaId, id);
    return this.prisma.establecimiento.update({ where: { id }, data: dto });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.establecimiento.update({ where: { id }, data: { activo: false } });
  }
}
