import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import type {
  CrearInsumoAplicadoDto,
  ActualizarInsumoAplicadoDto,
  ListarInsumosQuery,
} from './insumos-aplicados.dto';

@Injectable()
export class InsumosAplicadosService {
  constructor(private readonly prisma: PrismaService) {}

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
      }),
      this.prisma.insumoAplicado.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.insumoAplicado.findFirst({ where: { id, cuentaId } });
    if (!item) throw new NotFoundException(`Insumo ${id} no encontrado`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearInsumoAplicadoDto) {
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: dto.loteCampaniaId, cuentaId, activo: true },
      select: { id: true },
    });
    if (!lc) throw new BadRequestException('LoteCampania no encontrado en esta cuenta');

    return this.prisma.insumoAplicado.create({
      data: {
        cuentaId,
        loteCampaniaId: dto.loteCampaniaId,
        tipo: dto.tipo,
        producto: dto.producto,
        cantidad: dto.cantidad,
        unidad: dto.unidad,
        costoTotalUsd: dto.costoTotalUsd,
        formaPago: dto.formaPago,
      },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarInsumoAplicadoDto) {
    await this.obtenerPorId(cuentaId, id);
    return this.prisma.insumoAplicado.update({
      where: { id },
      data: {
        ...(dto.tipo && { tipo: dto.tipo }),
        ...(dto.producto && { producto: dto.producto }),
        ...(dto.cantidad !== undefined && { cantidad: dto.cantidad }),
        ...(dto.unidad && { unidad: dto.unidad }),
        ...(dto.costoTotalUsd !== undefined && { costoTotalUsd: dto.costoTotalUsd }),
        ...(dto.formaPago !== undefined && { formaPago: dto.formaPago }),
      },
    });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.insumoAplicado.update({ where: { id }, data: { activo: false } });
  }
}
