import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolEnCuenta } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type {
  ActualizarInsumoDto,
  CrearInsumoDto,
  MovimientoStockDto,
} from './insumos.dto';

const ROLES_ESCRITURA: RolEnCuenta[] = [RolEnCuenta.ingeniero, RolEnCuenta.operador];

@Injectable()
export class InsumosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- LECTURA ----------

  async listar(cuentaId: string) {
    const items = await this.prisma.insumo.findMany({
      where: { cuentaId, activo: true },
      orderBy: [{ nombre: 'asc' }],
    });
    return items.map((i) => this.adornarConBajoStock(i));
  }

  async obtener(cuentaId: string, id: string) {
    const i = await this.prisma.insumo.findFirst({ where: { id, cuentaId, activo: true } });
    if (!i) throw new NotFoundException('Insumo no encontrado');
    return this.adornarConBajoStock(i);
  }

  // ---------- ESCRITURA ----------

  async crear(user: UsuarioActual, dto: CrearInsumoDto) {
    this.asegurarEscritura(user);
    const existente = await this.prisma.insumo.findFirst({
      where: {
        cuentaId: user.cuentaId,
        nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
        activo: true,
      },
      select: { id: true },
    });
    if (existente) throw new ConflictException('Ya existe un insumo con ese nombre en esta cuenta');

    const insumo = await this.prisma.insumo.create({
      data: {
        cuentaId: user.cuentaId,
        nombre: dto.nombre.trim(),
        tipo: dto.tipo,
        unidad: dto.unidad.trim(),
        stockActual: new Prisma.Decimal(dto.stockActual),
        stockMinimo: new Prisma.Decimal(dto.stockMinimo),
        costoUnitarioUsd: dto.costoUnitarioUsd != null ? new Prisma.Decimal(dto.costoUnitarioUsd) : null,
        proveedor: dto.proveedor?.trim() || null,
        nota: dto.nota?.trim() || null,
      },
    });
    await this.verificarYAlertarStockBajo(insumo.id);
    return this.adornarConBajoStock(insumo);
  }

  async actualizar(user: UsuarioActual, id: string, dto: ActualizarInsumoDto) {
    this.asegurarEscritura(user);
    await this.obtener(user.cuentaId, id);

    if (dto.nombre) {
      const otro = await this.prisma.insumo.findFirst({
        where: {
          cuentaId: user.cuentaId,
          nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
          activo: true,
          id: { not: id },
        },
        select: { id: true },
      });
      if (otro) throw new ConflictException('Otro insumo ya usa ese nombre');
    }

    const actualizado = await this.prisma.insumo.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.unidad !== undefined && { unidad: dto.unidad.trim() }),
        ...(dto.stockActual !== undefined && { stockActual: new Prisma.Decimal(dto.stockActual) }),
        ...(dto.stockMinimo !== undefined && { stockMinimo: new Prisma.Decimal(dto.stockMinimo) }),
        ...(dto.costoUnitarioUsd !== undefined && {
          costoUnitarioUsd: dto.costoUnitarioUsd === null ? null : new Prisma.Decimal(dto.costoUnitarioUsd),
        }),
        ...(dto.proveedor !== undefined && { proveedor: dto.proveedor?.trim() || null }),
        ...(dto.nota !== undefined && { nota: dto.nota?.trim() || null }),
      },
    });
    await this.verificarYAlertarStockBajo(actualizado.id);
    return this.adornarConBajoStock(actualizado);
  }

  async eliminar(user: UsuarioActual, id: string) {
    this.asegurarEscritura(user);
    await this.obtener(user.cuentaId, id);
    await this.prisma.insumo.update({ where: { id }, data: { activo: false } });
  }

  /** Movimiento manual de stock (entrada por compra o ajuste). */
  async movimiento(user: UsuarioActual, id: string, dto: MovimientoStockDto) {
    this.asegurarEscritura(user);
    const i = await this.obtener(user.cuentaId, id);
    const nuevo = Number(i.stockActual) + dto.delta;
    if (nuevo < 0) {
      throw new BadRequestException('El movimiento dejaría el stock en negativo');
    }
    const actualizado = await this.prisma.insumo.update({
      where: { id },
      data: { stockActual: new Prisma.Decimal(nuevo) },
    });
    await this.verificarYAlertarStockBajo(actualizado.id);
    return this.adornarConBajoStock(actualizado);
  }

  // ---------- HOOKS PARA INSUMO APLICADO ----------

  /**
   * Llamado desde InsumosAplicadosService cuando se crea/actualiza/borra un aplicado
   * con insumoId. cantidadDelta es la cantidad NETA a aplicar (positiva descuenta,
   * negativa restaura).
   */
  async ajustarStockPorAplicacion(
    cuentaId: string,
    insumoId: string,
    cantidadDelta: number,
  ): Promise<void> {
    const i = await this.prisma.insumo.findFirst({
      where: { id: insumoId, cuentaId, activo: true },
      select: { id: true, stockActual: true, nombre: true },
    });
    if (!i) throw new NotFoundException('Insumo del catálogo no encontrado');

    const nuevo = Number(i.stockActual) - cantidadDelta;
    if (nuevo < 0) {
      throw new BadRequestException(
        `Stock insuficiente de "${i.nombre}". Disponible: ${Number(i.stockActual)}`,
      );
    }
    await this.prisma.insumo.update({
      where: { id: insumoId },
      data: { stockActual: new Prisma.Decimal(nuevo) },
    });
    await this.verificarYAlertarStockBajo(insumoId);
  }

  // ---------- HELPERS ----------

  /**
   * Crea una alerta tipo 'stock' si el insumo cruzó hacia abajo el umbral.
   * Idempotente: si ya existe una alerta activa no leída para ese insumo,
   * no duplica.
   */
  private async verificarYAlertarStockBajo(insumoId: string): Promise<void> {
    const i = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
      select: { id: true, cuentaId: true, nombre: true, stockActual: true, stockMinimo: true, unidad: true },
    });
    if (!i) return;
    const bajo = Number(i.stockActual) <= Number(i.stockMinimo);
    if (!bajo) return;

    // Idempotencia: si ya hay una alerta activa no leída con este insumoId, no duplico.
    const yaExiste = await this.prisma.alerta.findFirst({
      where: {
        cuentaId: i.cuentaId,
        tipo: 'stock',
        activo: true,
        leida: false,
        contexto: { path: ['insumoId'], equals: i.id },
      },
      select: { id: true },
    });
    if (yaExiste) return;

    const stockText = `${Number(i.stockActual).toLocaleString('es-AR')} ${i.unidad}`;
    const minText = `${Number(i.stockMinimo).toLocaleString('es-AR')} ${i.unidad}`;
    await this.prisma.alerta.create({
      data: {
        cuentaId: i.cuentaId,
        usuarioId: null,
        tipo: 'stock',
        severidad: Number(i.stockActual) === 0 ? 'critica' : 'warning',
        titulo: `Stock bajo: ${i.nombre}`,
        detalle: `Quedan ${stockText} y el mínimo configurado es ${minText}.`,
        contexto: { insumoId: i.id } as Prisma.InputJsonValue,
      },
    });
  }

  private adornarConBajoStock<T extends { stockActual: Prisma.Decimal | number; stockMinimo: Prisma.Decimal | number }>(
    i: T,
  ): T & { stockBajo: boolean } {
    return { ...i, stockBajo: Number(i.stockActual) <= Number(i.stockMinimo) };
  }

  private asegurarEscritura(user: UsuarioActual): void {
    if (!ROLES_ESCRITURA.includes(user.rolEnCuentaActiva)) {
      throw new ForbiddenException('No tenés permiso para modificar insumos');
    }
  }
}
