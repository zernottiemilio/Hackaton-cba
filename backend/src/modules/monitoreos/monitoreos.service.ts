import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RolEnCuenta } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';

import { PrismaService } from '../../prisma/prisma.service';
import type { AppConfig } from '../../config/configuration';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type { ActualizarMonitoreoDto, CrearMonitoreoDto } from './monitoreos.dto';

/** Sólo el ingeniero y el operador pueden crear/editar monitoreos. El propietario los ve. */
const ROLES_ESCRITURA: RolEnCuenta[] = [RolEnCuenta.ingeniero, RolEnCuenta.operador];

@Injectable()
export class MonitoreosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------- LECTURA ----------

  async listarPorLoteCampania(cuentaId: string, loteCampaniaId: string) {
    return this.prisma.monitoreo.findMany({
      where: { cuentaId, loteCampaniaId, activo: true },
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        autor: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async listarPorCuenta(cuentaId: string, limit = 50) {
    return this.prisma.monitoreo.findMany({
      where: { cuentaId, activo: true },
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        autor: { select: { id: true, nombre: true, email: true } },
        loteCampania: {
          include: {
            lote: { select: { id: true, nombre: true } },
            cultivo: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha: 'desc' },
      take: limit,
    });
  }

  async obtener(cuentaId: string, id: string) {
    const m = await this.prisma.monitoreo.findFirst({
      where: { id, cuentaId, activo: true },
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        autor: { select: { id: true, nombre: true, email: true } },
        loteCampania: {
          include: {
            lote: { select: { id: true, nombre: true } },
            cultivo: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!m) throw new NotFoundException('Monitoreo no encontrado');
    return m;
  }

  // ---------- ESCRITURA ----------

  async crear(user: UsuarioActual, dto: CrearMonitoreoDto) {
    this.asegurarEscritura(user);

    // El lote-campania tiene que pertenecer a la cuenta activa
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: dto.loteCampaniaId, cuentaId: user.cuentaId, activo: true },
      select: { id: true },
    });
    if (!lc) throw new NotFoundException('Lote-campaña no encontrado en esta cuenta');

    return this.prisma.monitoreo.create({
      data: {
        cuentaId: user.cuentaId,
        loteCampaniaId: dto.loteCampaniaId,
        autorId: user.id,
        tipo: dto.tipo,
        fecha: new Date(dto.fecha),
        observaciones: dto.observaciones.trim(),
        prescripcion: dto.prescripcion?.trim() || null,
        urgencia: dto.urgencia,
        latitud: dto.latitud !== undefined ? new Prisma.Decimal(dto.latitud) : null,
        longitud: dto.longitud !== undefined ? new Prisma.Decimal(dto.longitud) : null,
      },
      include: { fotos: true, autor: { select: { id: true, nombre: true, email: true } } },
    });
  }

  async actualizar(user: UsuarioActual, id: string, dto: ActualizarMonitoreoDto) {
    this.asegurarEscritura(user);

    const existente = await this.prisma.monitoreo.findFirst({
      where: { id, cuentaId: user.cuentaId, activo: true },
      select: { id: true, autorId: true },
    });
    if (!existente) throw new NotFoundException('Monitoreo no encontrado');

    // Operador sólo puede editar lo suyo. Ingeniero edita cualquiera.
    if (user.rolEnCuentaActiva === RolEnCuenta.operador && existente.autorId !== user.id) {
      throw new ForbiddenException('Solo el ingeniero puede editar monitoreos de otros');
    }

    return this.prisma.monitoreo.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.fecha !== undefined && { fecha: new Date(dto.fecha) }),
        ...(dto.observaciones !== undefined && { observaciones: dto.observaciones.trim() }),
        ...(dto.prescripcion !== undefined && {
          prescripcion: dto.prescripcion?.trim() || null,
        }),
        ...(dto.urgencia !== undefined && { urgencia: dto.urgencia }),
        ...(dto.latitud !== undefined && {
          latitud: dto.latitud === null ? null : new Prisma.Decimal(dto.latitud),
        }),
        ...(dto.longitud !== undefined && {
          longitud: dto.longitud === null ? null : new Prisma.Decimal(dto.longitud),
        }),
      },
      include: { fotos: { orderBy: { orden: 'asc' } } },
    });
  }

  async eliminar(user: UsuarioActual, id: string) {
    this.asegurarEscritura(user);

    const existente = await this.prisma.monitoreo.findFirst({
      where: { id, cuentaId: user.cuentaId, activo: true },
      select: { id: true, autorId: true },
    });
    if (!existente) throw new NotFoundException('Monitoreo no encontrado');

    if (user.rolEnCuentaActiva === RolEnCuenta.operador && existente.autorId !== user.id) {
      throw new ForbiddenException('Solo el ingeniero puede borrar monitoreos de otros');
    }

    await this.prisma.monitoreo.update({ where: { id }, data: { activo: false } });
  }

  // ---------- FOTOS ----------

  /**
   * Persiste las fotos ya escritas a disco (Multer ya las guardó). Recibe los
   * nombres de archivo relativos al UPLOADS_DIR y crea los registros FotoMonitoreo.
   */
  async agregarFotos(
    user: UsuarioActual,
    monitoreoId: string,
    archivos: Express.Multer.File[],
  ) {
    this.asegurarEscritura(user);

    const monitoreo = await this.prisma.monitoreo.findFirst({
      where: { id: monitoreoId, cuentaId: user.cuentaId, activo: true },
      select: { id: true, autorId: true, fotos: { select: { orden: true } } },
    });
    if (!monitoreo) {
      // Si el monitoreo no es válido, limpiamos los archivos para no dejar basura
      await this.limpiarArchivos(archivos);
      throw new NotFoundException('Monitoreo no encontrado');
    }

    if (user.rolEnCuentaActiva === RolEnCuenta.operador && monitoreo.autorId !== user.id) {
      await this.limpiarArchivos(archivos);
      throw new ForbiddenException('Solo el ingeniero puede agregar fotos a monitoreos de otros');
    }

    if (archivos.length === 0) {
      throw new BadRequestException('Subí al menos una imagen');
    }

    const ordenInicial = monitoreo.fotos.reduce((max, f) => Math.max(max, f.orden + 1), 0);

    return this.prisma.$transaction(
      archivos.map((archivo, i) =>
        this.prisma.fotoMonitoreo.create({
          data: {
            monitoreoId,
            url: `/uploads/monitoreos/${archivo.filename}`,
            orden: ordenInicial + i,
          },
        }),
      ),
    );
  }

  async eliminarFoto(user: UsuarioActual, monitoreoId: string, fotoId: string) {
    this.asegurarEscritura(user);

    const foto = await this.prisma.fotoMonitoreo.findFirst({
      where: { id: fotoId, monitoreoId, monitoreo: { cuentaId: user.cuentaId } },
      include: { monitoreo: { select: { autorId: true } } },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    if (
      user.rolEnCuentaActiva === RolEnCuenta.operador &&
      foto.monitoreo.autorId !== user.id
    ) {
      throw new ForbiddenException('Solo el ingeniero puede borrar fotos de otros');
    }

    await this.prisma.fotoMonitoreo.delete({ where: { id: fotoId } });

    // Best-effort: borrar el archivo. Si falla (ej. ya borrado), no aborta.
    const baseDir = this.config.get('uploads', { infer: true }).dir;
    const archivo = join(baseDir, foto.url.replace(/^\/uploads\//, ''));
    fs.unlink(archivo).catch(() => undefined);
  }

  // ---------- HELPERS ----------

  private asegurarEscritura(user: UsuarioActual): void {
    if (!ROLES_ESCRITURA.includes(user.rolEnCuentaActiva)) {
      throw new ForbiddenException('No tenés permiso para escribir monitoreos');
    }
  }

  private async limpiarArchivos(archivos: Express.Multer.File[]): Promise<void> {
    await Promise.allSettled(archivos.map((a) => fs.unlink(a.path)));
  }
}
