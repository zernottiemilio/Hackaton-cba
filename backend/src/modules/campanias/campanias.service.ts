import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar, type PaginationQuery } from '../../common/pagination';
import type { CrearCampaniaDto, ActualizarCampaniaDto } from './campanias.dto';

@Injectable()
export class CampaniasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string, q: PaginationQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.search && { nombre: { contains: q.search, mode: 'insensitive' as const } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.campania.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { fechaInicio: 'desc' },
        include: { _count: { select: { lotesCampania: { where: { activo: true } } } } },
      }),
      this.prisma.campania.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.campania.findFirst({ where: { id, cuentaId } });
    if (!item) throw new NotFoundException(`Campaña ${id} no encontrada`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearCampaniaDto) {
    // temporada y tipo son aliases — si uno viene y el otro no, los igualamos.
    const temporada = dto.temporada ?? dto.tipo ?? null;
    // Si no llega anio, lo derivamos de fechaInicio.
    const anio = dto.anio ?? new Date(dto.fechaInicio).getUTCFullYear();
    return this.prisma.campania.create({
      data: {
        cuentaId,
        anio,
        temporada,
        nombre: dto.nombre,
        tipo: temporada,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarCampaniaDto) {
    await this.obtenerPorId(cuentaId, id);
    // Si nos pasan tipo (legacy) sin temporada, los sincronizamos.
    const temporada = dto.temporada !== undefined ? dto.temporada : dto.tipo;
    return this.prisma.campania.update({
      where: { id },
      data: {
        ...(dto.anio !== undefined && { anio: dto.anio }),
        ...(temporada !== undefined && { temporada, tipo: temporada }),
        ...(dto.nombre && { nombre: dto.nombre }),
        ...(dto.fechaInicio && { fechaInicio: new Date(dto.fechaInicio) }),
        ...(dto.fechaFin !== undefined && {
          fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        }),
      },
    });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.campania.update({ where: { id }, data: { activo: false } });
  }
}
