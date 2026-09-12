import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import type { CrearLaborDto, ActualizarLaborDto, ListarLaboresQuery } from './labores.dto';

@Injectable()
export class LaboresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string, q: ListarLaboresQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.loteCampaniaId && { loteCampaniaId: q.loteCampaniaId }),
      ...(q.tipo && { tipo: q.tipo }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.labor.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.labor.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.labor.findFirst({ where: { id, cuentaId } });
    if (!item) throw new NotFoundException(`Labor ${id} no encontrada`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearLaborDto) {
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: dto.loteCampaniaId, cuentaId, activo: true },
      select: { id: true },
    });
    if (!lc) throw new BadRequestException('LoteCampania no encontrado en esta cuenta');

    return this.prisma.labor.create({
      data: {
        cuentaId,
        loteCampaniaId: dto.loteCampaniaId,
        tipo: dto.tipo,
        fecha: new Date(dto.fecha),
        ejecutor: dto.ejecutor,
        costoTotalUsd: dto.costoTotalUsd,
        formaPago: dto.formaPago,
        nota: dto.nota,
      },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarLaborDto) {
    await this.obtenerPorId(cuentaId, id);
    return this.prisma.labor.update({
      where: { id },
      data: {
        ...(dto.tipo && { tipo: dto.tipo }),
        ...(dto.fecha && { fecha: new Date(dto.fecha) }),
        ...(dto.ejecutor && { ejecutor: dto.ejecutor }),
        ...(dto.costoTotalUsd !== undefined && { costoTotalUsd: dto.costoTotalUsd }),
        ...(dto.formaPago !== undefined && { formaPago: dto.formaPago }),
        ...(dto.nota !== undefined && { nota: dto.nota }),
      },
    });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.labor.update({ where: { id }, data: { activo: false } });
  }
}
