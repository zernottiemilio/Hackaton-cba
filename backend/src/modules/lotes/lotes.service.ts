import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import type { CrearLoteDto, ActualizarLoteDto, ListarLotesQuery } from './lotes.dto';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string, q: ListarLotesQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.establecimientoId && { establecimientoId: q.establecimientoId }),
      ...(q.search && { nombre: { contains: q.search, mode: 'insensitive' as const } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lote.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { nombre: 'asc' },
        include: { establecimiento: { select: { id: true, nombre: true } } },
      }),
      this.prisma.lote.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.lote.findFirst({
      where: { id, cuentaId },
      include: { establecimiento: { select: { id: true, nombre: true } } },
    });
    if (!item) throw new NotFoundException(`Lote ${id} no encontrado`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearLoteDto) {
    // Verificar que el establecimiento pertenezca a la cuenta
    const est = await this.prisma.establecimiento.findFirst({
      where: { id: dto.establecimientoId, cuentaId, activo: true },
      select: { id: true },
    });
    if (!est) throw new BadRequestException('Establecimiento no encontrado en esta cuenta');

    return this.prisma.lote.create({
      data: {
        cuentaId,
        establecimientoId: dto.establecimientoId,
        nombre: dto.nombre,
        superficieHa: dto.superficieHa,
        tenencia: dto.tenencia,
        arrendamientoValor: dto.arrendamientoValor,
        arrendamientoUnidad: dto.arrendamientoUnidad,
      },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarLoteDto) {
    await this.obtenerPorId(cuentaId, id);
    return this.prisma.lote.update({ where: { id }, data: dto });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.lote.update({ where: { id }, data: { activo: false } });
  }
}
