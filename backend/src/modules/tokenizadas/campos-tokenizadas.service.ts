import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { CrearCampoDto, ActualizarCampoDto } from './dto/campo.dto';

/**
 * Servicio para los "campos" del módulo tokenizadas. Trabaja sobre la tabla
 * `establecimientos` extendida con partido/provincia/geometria/fotos.
 */
@Injectable()
export class CamposTokenizadasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(cuentaId: string, dto: CrearCampoDto) {
    return this.prisma.establecimiento.create({
      data: {
        cuentaId,
        nombre: dto.nombre,
        partido: dto.partido,
        provincia: dto.provincia,
        superficieTotalHa: new Decimal(dto.superficieHa),
        geometria: dto.geometria as any,
        tenencia: dto.tenencia,
        fotos: dto.fotos,
        latitud: dto.latitud !== undefined ? new Decimal(dto.latitud) : null,
        longitud: dto.longitud !== undefined ? new Decimal(dto.longitud) : null,
        acopioHabitualId: dto.acopioHabitualId ?? null,
      },
      include: { acopioHabitual: true },
    });
  }

  async listar(cuentaId: string) {
    return this.prisma.establecimiento.findMany({
      where: { cuentaId, activo: true },
      include: {
        acopioHabitual: true,
        campaniasTokenizadas: {
          where: { estadoToken: { not: null } },
          include: {
            cultivo: true,
            tokenizacion: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detalle(id: string, cuentaId: string) {
    const campo = await this.prisma.establecimiento.findUnique({
      where: { id },
      include: {
        acopioHabitual: true,
        campaniasTokenizadas: {
          include: { cultivo: true, tokenizacion: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!campo) throw new NotFoundException('Campo no encontrado');
    if (campo.cuentaId !== cuentaId) throw new ForbiddenException();
    return campo;
  }

  async actualizar(id: string, cuentaId: string, dto: ActualizarCampoDto) {
    const campo = await this.prisma.establecimiento.findUnique({ where: { id } });
    if (!campo) throw new NotFoundException('Campo no encontrado');
    if (campo.cuentaId !== cuentaId) throw new ForbiddenException();

    return this.prisma.establecimiento.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.partido !== undefined && { partido: dto.partido }),
        ...(dto.provincia !== undefined && { provincia: dto.provincia }),
        ...(dto.superficieHa !== undefined && { superficieTotalHa: new Decimal(dto.superficieHa) }),
        ...(dto.geometria !== undefined && { geometria: dto.geometria as any }),
        ...(dto.tenencia !== undefined && { tenencia: dto.tenencia }),
        ...(dto.fotos !== undefined && { fotos: dto.fotos }),
        ...(dto.latitud !== undefined && { latitud: new Decimal(dto.latitud) }),
        ...(dto.longitud !== undefined && { longitud: new Decimal(dto.longitud) }),
        ...(dto.acopioHabitualId !== undefined && { acopioHabitualId: dto.acopioHabitualId }),
      },
      include: { acopioHabitual: true },
    });
  }

  async listarAcopios() {
    return this.prisma.acopio.findMany({
      where: { activo: true, convenioMarcoFirmado: true },
      include: { plantas: { where: { activa: true } } },
      orderBy: { razonSocial: 'asc' },
    });
  }

  async listarCultivos() {
    return this.prisma.cultivo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
