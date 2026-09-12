import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import { InsumosService } from '../insumos/insumos.service';
import type {
  CrearInsumoAplicadoDto,
  ActualizarInsumoAplicadoDto,
  ListarInsumosQuery,
} from './insumos-aplicados.dto';

@Injectable()
export class InsumosAplicadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insumos: InsumosService,
  ) {}

  async listar(cuentaId: string, q: ListarInsumosQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.loteCampaniaId && { loteCampaniaId: q.loteCampaniaId }),
      ...(q.tipo && { tipo: q.tipo }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.insumoAplicado.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: { insumo: { select: { id: true, nombre: true, stockActual: true, unidad: true } } },
      }),
      this.prisma.insumoAplicado.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.insumoAplicado.findFirst({
      where: { id, cuentaId },
      include: { insumo: { select: { id: true, nombre: true } } },
    });
    if (!item) throw new NotFoundException(`Insumo ${id} no encontrado`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearInsumoAplicadoDto) {
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: dto.loteCampaniaId, cuentaId, activo: true },
      select: { id: true },
    });
    if (!lc) throw new BadRequestException('LoteCampania no encontrado en esta cuenta');

    // Si está linkeado al catálogo, descontamos stock primero. Si falla, no creamos.
    if (dto.insumoId) {
      await this.insumos.ajustarStockPorAplicacion(cuentaId, dto.insumoId, dto.cantidad);
    }

    return this.prisma.insumoAplicado.create({
      data: {
        cuentaId,
        loteCampaniaId: dto.loteCampaniaId,
        insumoId: dto.insumoId ?? null,
        tipo: dto.tipo,
        producto: dto.producto,
        cantidad: dto.cantidad,
        unidad: dto.unidad,
        costoTotalUsd: dto.costoTotalUsd,
        formaPago: dto.formaPago,
      },
      include: { insumo: { select: { id: true, nombre: true, stockActual: true, unidad: true } } },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarInsumoAplicadoDto) {
    const previo = await this.obtenerPorId(cuentaId, id);

    // Diferencial de stock: restaurar lo previo (si tenía insumoId), descontar lo nuevo.
    const cantidadNueva = dto.cantidad ?? Number(previo.cantidad);
    const insumoIdNuevo = dto.insumoId === undefined ? previo.insumoId : dto.insumoId;

    if (previo.insumoId && previo.insumoId === insumoIdNuevo) {
      // Mismo insumo: ajuste por diferencia
      const delta = cantidadNueva - Number(previo.cantidad);
      if (delta !== 0) {
        await this.insumos.ajustarStockPorAplicacion(cuentaId, previo.insumoId, delta);
      }
    } else {
      // Cambió el vínculo: restaurar previo y descontar nuevo
      if (previo.insumoId) {
        await this.insumos.ajustarStockPorAplicacion(cuentaId, previo.insumoId, -Number(previo.cantidad));
      }
      if (insumoIdNuevo) {
        await this.insumos.ajustarStockPorAplicacion(cuentaId, insumoIdNuevo, cantidadNueva);
      }
    }

    return this.prisma.insumoAplicado.update({
      where: { id },
      data: {
        ...(dto.insumoId !== undefined && { insumoId: dto.insumoId }),
        ...(dto.tipo && { tipo: dto.tipo }),
        ...(dto.producto && { producto: dto.producto }),
        ...(dto.cantidad !== undefined && { cantidad: dto.cantidad }),
        ...(dto.unidad && { unidad: dto.unidad }),
        ...(dto.costoTotalUsd !== undefined && { costoTotalUsd: dto.costoTotalUsd }),
        ...(dto.formaPago !== undefined && { formaPago: dto.formaPago }),
      },
      include: { insumo: { select: { id: true, nombre: true, stockActual: true, unidad: true } } },
    });
  }

  async eliminar(cuentaId: string, id: string) {
    const previo = await this.obtenerPorId(cuentaId, id);
    if (previo.insumoId) {
      // Restaurar stock antes del soft delete
      await this.insumos.ajustarStockPorAplicacion(cuentaId, previo.insumoId, -Number(previo.cantidad));
    }
    await this.prisma.insumoAplicado.update({ where: { id }, data: { activo: false } });
  }
}
