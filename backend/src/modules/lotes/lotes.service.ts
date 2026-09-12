import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import type {
  ActualizarLoteDto,
  CrearLoteDto,
  DividirLoteDto,
  ListarLotesQuery,
} from './lotes.dto';

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
      include: {
        establecimiento: { select: { id: true, nombre: true, ubicacion: true } },
        // Historial completo de campañas en este lote, más reciente primero.
        lotesCampania: {
          where: { activo: true },
          orderBy: { createdAt: 'desc' },
          include: {
            campania: { select: { id: true, nombre: true, tipo: true, fechaInicio: true, fechaFin: true } },
            cultivo: { select: { id: true, nombre: true } },
            variedad: { select: { id: true, nombre: true } },
          },
        },
      },
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

  /**
   * Divide un lote en N sub-lotes. Los nuevos heredan tenencia y arrendamiento
   * del original. La suma de superficies no puede exceder la del lote original.
   * El histórico (lotes_campania, labores, etc.) queda en el lote original;
   * los nuevos arrancan limpios para campañas futuras.
   */
  async dividir(cuentaId: string, id: string, dto: DividirLoteDto) {
    const lote = await this.obtenerPorId(cuentaId, id);
    const supTotal = Number(lote.superficieHa);
    const supPartes = dto.partes.reduce((s, p) => s + p.superficieHa, 0);

    if (supPartes > supTotal + 0.0001) {
      throw new BadRequestException(
        `La suma de las partes (${supPartes.toFixed(2)} ha) supera la del lote (${supTotal.toFixed(2)} ha)`,
      );
    }

    const nombresNuevos = new Set(dto.partes.map((p) => p.nombre.trim().toLowerCase()));
    if (nombresNuevos.size !== dto.partes.length) {
      throw new BadRequestException('Las partes no pueden tener el mismo nombre');
    }

    // Validar que ningún nombre choque con un lote existente activo del establecimiento.
    const choque = await this.prisma.lote.findFirst({
      where: {
        cuentaId,
        establecimientoId: lote.establecimientoId,
        activo: true,
        nombre: { in: dto.partes.map((p) => p.nombre.trim()), mode: 'insensitive' },
      },
      select: { id: true, nombre: true },
    });
    if (choque && choque.id !== id) {
      throw new BadRequestException(`Ya existe un lote "${choque.nombre}" en este establecimiento`);
    }

    return this.prisma.$transaction(async (tx) => {
      const nuevos = [];
      for (const parte of dto.partes) {
        const creado = await tx.lote.create({
          data: {
            cuentaId,
            establecimientoId: lote.establecimientoId,
            nombre: parte.nombre.trim(),
            superficieHa: new Prisma.Decimal(parte.superficieHa),
            tenencia: lote.tenencia,
            arrendamientoValor: lote.arrendamientoValor,
            arrendamientoUnidad: lote.arrendamientoUnidad,
          },
        });
        nuevos.push(creado);
      }

      const original = dto.archivarOriginal
        ? await tx.lote.update({
            where: { id },
            data: { activo: false },
          })
        : lote;

      return { original, nuevos };
    });
  }
}
