import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoFactura, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { GenerarFacturaDto, MarcarPagadaDto, SetearSuscripcionDto } from './facturacion.dto';

interface Concepto {
  descripcion: string;
  cantidad: number;
  precioUnitarioUsd: number;
  subtotalUsd: number;
}

@Injectable()
export class FacturacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ===== Suscripción por cuenta =====

  async obtenerSuscripcion(cuentaId: string) {
    return this.prisma.suscripcionCuenta.findUnique({ where: { cuentaId } });
  }

  /// Upsert: si no existe, la crea; si existe, la actualiza.
  async setearSuscripcion(cuentaId: string, dto: SetearSuscripcionDto) {
    const cuenta = await this.prisma.cuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.suscripcionCuenta.upsert({
      where: { cuentaId },
      update: {
        plan: dto.plan,
        precioMensualUsd: new Prisma.Decimal(dto.precioMensualUsd),
        diaVencimiento: dto.diaVencimiento,
        activa: dto.activa,
        notaInterna: dto.notaInterna ?? null,
      },
      create: {
        cuentaId,
        plan: dto.plan,
        precioMensualUsd: new Prisma.Decimal(dto.precioMensualUsd),
        diaVencimiento: dto.diaVencimiento,
        activa: dto.activa,
        notaInterna: dto.notaInterna ?? null,
      },
    });
  }

  async eliminarSuscripcion(cuentaId: string) {
    await this.prisma.suscripcionCuenta.delete({ where: { cuentaId } }).catch(() => null);
    return { ok: true };
  }

  // ===== Facturas =====

  async listar(params: { estado?: EstadoFactura; cuentaId?: string } = {}) {
    const facturas = await this.prisma.factura.findMany({
      where: {
        ...(params.estado && { estado: params.estado }),
        ...(params.cuentaId && { cuentaId: params.cuentaId }),
      },
      orderBy: { emitidaEn: 'desc' },
      include: { cuenta: { select: { id: true, nombre: true, emailContacto: true } } },
    });

    // Marcamos como vencida en respuesta (no en DB — eso lo haría un cron). Solo cosmético.
    const hoy = new Date();
    return facturas.map((f) => ({
      id: f.id,
      numero: f.numero,
      cuenta: f.cuenta,
      periodoMes: f.periodoMes,
      periodoAnio: f.periodoAnio,
      conceptos: f.conceptos,
      subtotalUsd: Number(f.subtotalUsd),
      impuestosUsd: Number(f.impuestosUsd),
      totalUsd: Number(f.totalUsd),
      estado: f.estado === 'pendiente' && f.vencimiento < hoy ? 'vencida' : f.estado,
      emitidaEn: f.emitidaEn,
      vencimiento: f.vencimiento,
      pagadaEn: f.pagadaEn,
      metodoPago: f.metodoPago,
      notaInterna: f.notaInterna,
    }));
  }

  async detalle(id: string) {
    const f = await this.prisma.factura.findUnique({
      where: { id },
      include: { cuenta: { select: { id: true, nombre: true, emailContacto: true } } },
    });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }

  async generar(dto: GenerarFacturaDto) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: dto.cuentaId },
      include: { suscripcion: true },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    // Si no vienen conceptos, los armamos desde la suscripción.
    let conceptos: Concepto[] = [];
    if (dto.conceptos && dto.conceptos.length > 0) {
      conceptos = dto.conceptos.map((c) => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precioUnitarioUsd: c.precioUnitarioUsd,
        subtotalUsd: c.cantidad * c.precioUnitarioUsd,
      }));
    } else {
      if (!cuenta.suscripcion) {
        throw new BadRequestException('La cuenta no tiene suscripción configurada — pasá conceptos manualmente o seteala antes.');
      }
      const precio = Number(cuenta.suscripcion.precioMensualUsd);
      conceptos = [{
        descripcion: `Suscripción AgroFácil — ${nombreMes(dto.periodoMes)} ${dto.periodoAnio}`,
        cantidad: 1,
        precioUnitarioUsd: precio,
        subtotalUsd: precio,
      }];
    }

    const subtotalUsd = conceptos.reduce((s, c) => s + c.subtotalUsd, 0);
    const impuestosUsd = dto.impuestosUsd ?? 0;
    const totalUsd = subtotalUsd + impuestosUsd;

    // Unique por (cuentaId, periodoMes, periodoAnio) — evita duplicar la misma factura del mes
    const yaExiste = await this.prisma.factura.findUnique({
      where: { cuentaId_periodoMes_periodoAnio: { cuentaId: cuenta.id, periodoMes: dto.periodoMes, periodoAnio: dto.periodoAnio } },
    });
    if (yaExiste) throw new ConflictException(`Ya existe una factura para esta cuenta en ${nombreMes(dto.periodoMes)} ${dto.periodoAnio}`);

    const factura = await this.prisma.factura.create({
      data: {
        cuentaId: cuenta.id,
        periodoMes: dto.periodoMes,
        periodoAnio: dto.periodoAnio,
        conceptos: conceptos as unknown as Prisma.JsonArray,
        subtotalUsd: new Prisma.Decimal(subtotalUsd),
        impuestosUsd: new Prisma.Decimal(impuestosUsd),
        totalUsd: new Prisma.Decimal(totalUsd),
        vencimiento: new Date(dto.vencimiento + 'T00:00:00Z'),
        notaInterna: dto.notaInterna ?? null,
      },
    });

    if (dto.enviarEmail && cuenta.emailContacto) {
      await this.enviarFacturaPorEmail(factura.id);
    }

    return factura;
  }

  async marcarPagada(id: string, dto: MarcarPagadaDto) {
    const factura = await this.prisma.factura.findUnique({ where: { id } });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estado === 'pagada') return factura;

    return this.prisma.factura.update({
      where: { id },
      data: {
        estado: 'pagada',
        pagadaEn: dto.pagadaEn ? new Date(dto.pagadaEn + 'T00:00:00Z') : new Date(),
        metodoPago: dto.metodoPago,
      },
    });
  }

  async anular(id: string) {
    const factura = await this.prisma.factura.findUnique({ where: { id } });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estado === 'pagada') throw new ConflictException('No se puede anular una factura ya pagada');
    return this.prisma.factura.update({ where: { id }, data: { estado: 'anulada' } });
  }

  async reenviarEmail(id: string) {
    await this.enviarFacturaPorEmail(id);
    return { ok: true };
  }

  private async enviarFacturaPorEmail(facturaId: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id: facturaId },
      include: { cuenta: { select: { nombre: true, emailContacto: true } } },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (!factura.cuenta.emailContacto) return;

    const html = plantillaFactura(factura);
    const text =
      `Hola,\n\n` +
      `Te enviamos la factura F-${String(factura.numero).padStart(4, '0')} de AgroFácil.\n` +
      `Período: ${nombreMes(factura.periodoMes)} ${factura.periodoAnio}\n` +
      `Total: USD ${Number(factura.totalUsd).toFixed(2)}\n` +
      `Vencimiento: ${factura.vencimiento.toISOString().slice(0, 10)}\n`;

    await this.email.enviar({
      to: factura.cuenta.emailContacto,
      subject: `Factura F-${String(factura.numero).padStart(4, '0')} — AgroFácil`,
      html,
      text,
    });
  }
}

function nombreMes(mes: number): string {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[mes - 1] ?? `Mes ${mes}`;
}

function plantillaFactura(factura: {
  numero: number;
  cuenta: { nombre: string };
  periodoMes: number;
  periodoAnio: number;
  conceptos: unknown;
  subtotalUsd: Prisma.Decimal;
  impuestosUsd: Prisma.Decimal;
  totalUsd: Prisma.Decimal;
  vencimiento: Date;
}): string {
  const conceptos = factura.conceptos as Concepto[];
  const filas = conceptos.map((c) => `
    <tr>
      <td style="padding:8px 0; color:#334155;">${escapeHtml(c.descripcion)}</td>
      <td style="padding:8px 0; text-align:right; color:#334155;">${c.cantidad}</td>
      <td style="padding:8px 0; text-align:right; color:#334155;">USD ${c.precioUnitarioUsd.toFixed(2)}</td>
      <td style="padding:8px 0; text-align:right; color:#0F172A; font-weight:600;">USD ${c.subtotalUsd.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.05);" cellpadding="0" cellspacing="0">
        <tr><td style="background:#047C00;padding:24px;color:#fff;">
          <div style="font-size:20px;font-weight:800;">AgroFácil</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px;">Factura</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px 0;color:#64748B;font-size:12px;">Factura N°</p>
          <p style="margin:0 0 24px 0;color:#0F172A;font-size:22px;font-weight:700;">F-${String(factura.numero).padStart(4, '0')}</p>
          <table width="100%" style="margin-bottom:24px;">
            <tr>
              <td style="color:#64748B;font-size:12px;padding-bottom:4px;">Cliente</td>
              <td style="color:#64748B;font-size:12px;padding-bottom:4px;text-align:right;">Período</td>
            </tr>
            <tr>
              <td style="color:#0F172A;font-weight:600;">${escapeHtml(factura.cuenta.nombre)}</td>
              <td style="color:#0F172A;font-weight:600;text-align:right;">${nombreMes(factura.periodoMes)} ${factura.periodoAnio}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:12px;color:#64748B;font-size:12px;">Vencimiento</td>
            </tr>
            <tr>
              <td colspan="2" style="color:#0F172A;font-weight:600;">${factura.vencimiento.toISOString().slice(0, 10)}</td>
            </tr>
          </table>
          <table width="100%" style="border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;margin-bottom:16px;">
            <thead><tr>
              <th align="left" style="padding:8px 0;color:#64748B;font-size:11px;text-transform:uppercase;font-weight:600;">Concepto</th>
              <th align="right" style="padding:8px 0;color:#64748B;font-size:11px;text-transform:uppercase;font-weight:600;">Cant.</th>
              <th align="right" style="padding:8px 0;color:#64748B;font-size:11px;text-transform:uppercase;font-weight:600;">P.Unit.</th>
              <th align="right" style="padding:8px 0;color:#64748B;font-size:11px;text-transform:uppercase;font-weight:600;">Subtotal</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
          <table width="100%">
            <tr>
              <td style="text-align:right;color:#64748B;font-size:13px;padding:4px 0;">Subtotal</td>
              <td style="text-align:right;color:#0F172A;font-size:13px;padding:4px 0;width:100px;">USD ${Number(factura.subtotalUsd).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align:right;color:#64748B;font-size:13px;padding:4px 0;">Impuestos</td>
              <td style="text-align:right;color:#0F172A;font-size:13px;padding:4px 0;">USD ${Number(factura.impuestosUsd).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align:right;color:#0F172A;font-size:16px;font-weight:700;padding:12px 0 0 0;border-top:2px solid #047C00;">Total</td>
              <td style="text-align:right;color:#047C00;font-size:18px;font-weight:800;padding:12px 0 0 0;border-top:2px solid #047C00;">USD ${Number(factura.totalUsd).toFixed(2)}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;color:#64748B;font-size:12px;line-height:1.5;">
            Para abonar, contactá a soporte@agrofacilar.com o respondé este email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
