import {
  BadRequestException,
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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';

import { AsistenteService } from './asistente.service';
import {
  CrearConversacionDto,
  RenombrarConversacionDto,
} from './asistente.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const EXTENSIONES_AUDIO = ['.webm', '.mp3', '.mp4', '.m4a', '.ogg', '.oga', '.wav'];
const MAX_IMAGENES = 4;
const MAX_BYTES_IMG = 8 * 1024 * 1024;   // 8 MB por imagen
const MAX_BYTES_AUDIO = 20 * 1024 * 1024; // 20 MB para una nota de audio

const ASISTENTE_STORAGE = diskStorage({
  destination: async (_req, _file, cb) => {
    const baseDir = process.env.UPLOADS_DIR ?? './uploads';
    const dir = join(baseDir, 'asistente');
    await mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

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

  /**
   * Enviar mensaje. Acepta multipart:
   *  - `contenido` (texto, opcional si vienen imágenes o audio)
   *  - hasta 4 archivos en el campo `imagenes`
   *  - 1 archivo en `audio` (nota de voz que se guarda para reproducir luego)
   */
  @Post(':id/mensajes')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'imagenes', maxCount: MAX_IMAGENES },
        { name: 'audio', maxCount: 1 },
      ],
      {
        storage: ASISTENTE_STORAGE,
        fileFilter: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          if (file.fieldname === 'imagenes') {
            if (!EXTENSIONES_IMAGEN.includes(ext)) {
              return cb(new BadRequestException(`Extensión de imagen no permitida: ${ext}`), false);
            }
          } else if (file.fieldname === 'audio') {
            if (!EXTENSIONES_AUDIO.includes(ext)) {
              return cb(new BadRequestException(`Extensión de audio no permitida: ${ext}`), false);
            }
          }
          cb(null, true);
        },
        // Multer límite global; aplicamos chequeo más fino abajo.
        limits: { fileSize: MAX_BYTES_AUDIO },
      },
    ),
  )
  enviarMensaje(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('contenido') contenido: string | undefined,
    @UploadedFiles() files: { imagenes?: Express.Multer.File[]; audio?: Express.Multer.File[] } = {},
  ) {
    const imagenes = files.imagenes ?? [];
    const audio = files.audio?.[0];
    for (const img of imagenes) {
      if (img.size > MAX_BYTES_IMG) {
        throw new BadRequestException(`"${img.originalname}" pesa más de 8 MB`);
      }
    }
    const texto = (contenido ?? '').trim();
    if (!texto && imagenes.length === 0 && !audio) {
      throw new BadRequestException('Mandá texto, una imagen o una nota de audio');
    }
    return this.service.enviarMensaje(user.cuentaId, user.id, id, texto, imagenes, audio);
  }
}
