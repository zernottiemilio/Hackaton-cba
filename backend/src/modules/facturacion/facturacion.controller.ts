import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EstadoFactura } from '@prisma/client';
import { FacturacionService } from './facturacion.service';
import {
  GenerarFacturaDto,
  MarcarPagadaDto,
  SetearSuscripcionDto,
} from './facturacion.dto';
import { SuperAdmin } from '../../common/decorators/super-admin.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@SuperAdmin()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class FacturacionController {
  constructor(private readonly service: FacturacionService) {}

  // ===== Suscripciones (por cuenta) =====

  @Get('cuentas/:id/suscripcion')
  obtenerSuscripcion(@Param('id', ParseUUIDPipe) cuentaId: string) {
    return this.service.obtenerSuscripcion(cuentaId);
  }

  @Put('cuentas/:id/suscripcion')
  @HttpCode(HttpStatus.OK)
  setearSuscripcion(@Param('id', ParseUUIDPipe) cuentaId: string, @Body() dto: SetearSuscripcionDto) {
    return this.service.setearSuscripcion(cuentaId, dto);
  }

  @Delete('cuentas/:id/suscripcion')
  @HttpCode(HttpStatus.OK)
  eliminarSuscripcion(@Param('id', ParseUUIDPipe) cuentaId: string) {
    return this.service.eliminarSuscripcion(cuentaId);
  }

  // ===== Facturas =====

  @Get('facturas')
  listar(
    @Query('estado') estado?: EstadoFactura,
    @Query('cuentaId') cuentaId?: string,
  ) {
    return this.service.listar({ estado, cuentaId });
  }

  @Get('facturas/:id')
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(id);
  }

  @Post('facturas')
  @HttpCode(HttpStatus.CREATED)
  generar(@Body() dto: GenerarFacturaDto) {
    return this.service.generar(dto);
  }

  @Patch('facturas/:id/pagada')
  @HttpCode(HttpStatus.OK)
  marcarPagada(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarcarPagadaDto) {
    return this.service.marcarPagada(id, dto);
  }

  @Patch('facturas/:id/anular')
  @HttpCode(HttpStatus.OK)
  anular(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.anular(id);
  }

  @Post('facturas/:id/reenviar-email')
  @HttpCode(HttpStatus.OK)
  reenviar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reenviarEmail(id);
  }
}
