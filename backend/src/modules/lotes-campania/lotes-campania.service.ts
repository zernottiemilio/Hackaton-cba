import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularSkip, paginar } from '../../common/pagination';
import type {
  CrearLoteCampaniaDto,
  ActualizarLoteCampaniaDto,
  ListarLotesCampaniaQuery,
} from './lotes-campania.dto';

@Injectable()
export class LotesCampaniaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string, q: ListarLotesCampaniaQuery) {
    const where = {
      cuentaId,
      activo: q.activo ?? true,
      ...(q.campaniaId && { campaniaId: q.campaniaId }),
      ...(q.loteId && { loteId: q.loteId }),
      ...(q.cultivoId && { cultivoId: q.cultivoId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loteCampania.findMany({
        where,
        skip: calcularSkip(q.page, q.limit),
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lote: { include: { establecimiento: { select: { id: true, nombre: true } } } },
          campania: true,
          cultivo: true,
        },
      }),
      this.prisma.loteCampania.count({ where }),
    ]);
    return paginar(items, total, q.page, q.limit);
  }

  async obtenerPorId(cuentaId: string, id: string) {
    const item = await this.prisma.loteCampania.findFirst({
      where: { id, cuentaId },
      include: {
        lote: { include: { establecimiento: true } },
        campania: true,
        cultivo: true,
        labores: { where: { activo: true }, orderBy: { fecha: 'desc' } },
        insumosAplicados: { where: { activo: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException(`LoteCampania ${id} no encontrado`);
    return item;
  }

  async crear(cuentaId: string, dto: CrearLoteCampaniaDto) {
    // Verificar que lote y campania pertenezcan a la cuenta
    const [lote, campania, cultivo] = await Promise.all([
      this.prisma.lote.findFirst({ where: { id: dto.loteId, cuentaId, activo: true } }),
      this.prisma.campania.findFirst({ where: { id: dto.campaniaId, cuentaId, activo: true } }),
      this.prisma.cultivo.findUnique({ where: { id: dto.cultivoId } }),
    ]);
    if (!lote) throw new BadRequestException('Lote no encontrado en esta cuenta');
    if (!campania) throw new BadRequestException('Campaña no encontrada en esta cuenta');
    if (!cultivo) throw new BadRequestException('Cultivo no válido');

    // Validar unicidad lote+campania
    const existente = await this.prisma.loteCampania.findUnique({
      where: { lote_campania_unico: { loteId: dto.loteId, campaniaId: dto.campaniaId } },
    });
    if (existente) throw new ConflictException('Ese lote ya está asignado a esa campaña');

    return this.prisma.loteCampania.create({
      data: {
        cuentaId,
        loteId: dto.loteId,
        campaniaId: dto.campaniaId,
        cultivoId: dto.cultivoId,
        superficieSembradaHa: dto.superficieSembradaHa,
        fechaSiembra: dto.fechaSiembra ? new Date(dto.fechaSiembra) : null,
        rindeEstimadoQqHa: dto.rindeEstimadoQqHa,
        precioGranoUsdTn: dto.precioGranoUsdTn,
      },
    });
  }

  async actualizar(cuentaId: string, id: string, dto: ActualizarLoteCampaniaDto) {
    await this.obtenerPorId(cuentaId, id);

    if (dto.cultivoId) {
      const cultivo = await this.prisma.cultivo.findUnique({ where: { id: dto.cultivoId } });
      if (!cultivo) throw new BadRequestException('Cultivo no válido');
    }

    return this.prisma.loteCampania.update({
      where: { id },
      data: {
        ...(dto.cultivoId && { cultivoId: dto.cultivoId }),
        ...(dto.superficieSembradaHa !== undefined && { superficieSembradaHa: dto.superficieSembradaHa }),
        ...(dto.fechaSiembra !== undefined && {
          fechaSiembra: dto.fechaSiembra ? new Date(dto.fechaSiembra) : null,
        }),
        ...(dto.rindeEstimadoQqHa !== undefined && { rindeEstimadoQqHa: dto.rindeEstimadoQqHa }),
        ...(dto.rindeRealQqHa !== undefined && { rindeRealQqHa: dto.rindeRealQqHa }),
        ...(dto.precioGranoUsdTn !== undefined && { precioGranoUsdTn: dto.precioGranoUsdTn }),
        ...(dto.fechaCosecha !== undefined && {
          fechaCosecha: dto.fechaCosecha ? new Date(dto.fechaCosecha) : null,
        }),
      },
    });
  }

  async eliminar(cuentaId: string, id: string) {
    await this.obtenerPorId(cuentaId, id);
    await this.prisma.loteCampania.update({ where: { id }, data: { activo: false } });
  }
}
