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
import { AsistenteService } from './asistente.service';
import {
  CrearConversacionDto,
  EnviarMensajeDto,
  RenombrarConversacionDto,
} from './asistente.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('asistente/conversaciones')
export class AsistenteController {
  constructor(private readonly service: AsistenteService) {}

  @Get()
  listar(@Usuario() user: UsuarioActual) {
    return this.service.listarConversaciones(user.cuentaId, user.id);
  }

  @Get(':id')
  obtener(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtenerConversacion(user.cuentaId, user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearConversacionDto) {
    return this.service.crearConversacion(user.cuentaId, user.id, dto.titulo);
  }

  @Patch(':id')
  renombrar(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenombrarConversacionDto,
  ) {
    return this.service.renombrarConversacion(user.cuentaId, user.id, id, dto.titulo);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminarConversacion(user.cuentaId, user.id, id);
  }

  /** Enviar mensaje del usuario, recibir respuesta del asistente.
   *  Si la conversación todavía no tiene título, se autogenera. */
  @Post(':id/mensajes')
  @HttpCode(HttpStatus.OK)
  enviarMensaje(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarMensajeDto,
  ) {
    return this.service.enviarMensaje(user.cuentaId, user.id, id, dto.contenido);
  }
}
