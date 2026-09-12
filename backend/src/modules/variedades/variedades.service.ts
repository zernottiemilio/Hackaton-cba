import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActualizarVariedadDto, CrearVariedadDto, ListarVariedadesQuery } from './variedades.dto';

@Injectable()
export class VariedadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(q: ListarVariedadesQuery) {
    return this.prisma.variedad.findMany({
      where: {
        activo: true,
        ...(q.cultivoId && { cultivoId: q.cultivoId }),
      },
      include: { cultivo: { select: { nombre: true } } },
      orderBy: [{ cultivoId: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crear(dto: CrearVariedadDto) {
    const cultivo = await this.prisma.cultivo.findUnique({ where: { id: dto.cultivoId } });
    if (!cultivo) throw new BadRequestException('Cultivo no válido');

    const nombre = dto.nombre.trim();
    const existente = await this.prisma.variedad.findFirst({
      where: { cultivoId: dto.cultivoId, nombre: { equals: nombre, mode: 'insensitive' }, activo: true },
    });
    if (existente) throw new ConflictException(`La variedad "${nombre}" ya existe en ese cultivo`);

    return this.prisma.variedad.create({
      data: { cultivoId: dto.cultivoId, nombre },
    });
  }

  async actualizar(id: string, dto: ActualizarVariedadDto) {
    const v = await this.prisma.variedad.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`Variedad ${id} no encontrada`);
    return this.prisma.variedad.update({
      where: { id },
      data: { ...(dto.nombre && { nombre: dto.nombre.trim() }) },
    });
  }

  async eliminar(id: string) {
    const v = await this.prisma.variedad.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`Variedad ${id} no encontrada`);
    await this.prisma.variedad.update({ where: { id }, data: { activo: false } });
  }
}
