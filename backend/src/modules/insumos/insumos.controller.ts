import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { InsumosService } from './insumos.service';
import {
  ActualizarInsumoDto,
  CrearInsumoDto,
  MovimientoStockDto,
} from './insumos.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  listar(@Usuario() user: UsuarioActual) {
    return this.service.listar(user.cuentaId);
  }

  @Get(':id')
  obtener(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(user.cuentaId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearInsumoDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInsumoDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(user, id);
  }

  /** Movimiento manual de stock: entrada por compra o ajuste. */
  @Post(':id/movimiento')
  @HttpCode(HttpStatus.OK)
  movimiento(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MovimientoStockDto,
  ) {
    return this.service.movimiento(user, id, dto);
  }
}
