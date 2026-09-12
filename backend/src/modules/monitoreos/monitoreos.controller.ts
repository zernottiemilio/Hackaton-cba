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
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';

import { MonitoreosService } from './monitoreos.service';
import {
  ActualizarMonitoreoDto,
  CrearMonitoreoDto,
} from './monitoreos.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type { AppConfig } from '../../config/configuration';

const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const MAX_FOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

@Controller('monitoreos')
export class MonitoreosController {
  constructor(
    private readonly service: MonitoreosService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get()
  listar(
    @Usuario() user: UsuarioActual,
    @Query('loteCampaniaId') loteCampaniaId?: string,
  ) {
    if (loteCampaniaId) {
      return this.service.listarPorLoteCampania(user.cuentaId, loteCampaniaId);
    }
    return this.service.listarPorCuenta(user.cuentaId);
  }

  @Get(':id')
  obtener(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(user.cuentaId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearMonitoreoDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMonitoreoDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(user, id);
  }

  // ---------- FOTOS ----------

  @Post(':id/fotos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('fotos', MAX_FOTOS, {
      storage: diskStorage({
        destination: async (req, _file, cb) => {
          // Resolvemos el directorio en runtime para respetar UPLOADS_DIR.
          // ConfigService no se inyecta acá, usamos process.env directo.
          const baseDir = process.env.UPLOADS_DIR ?? './uploads';
          const dir = join(baseDir, 'monitoreos');
          await mkdir(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_IMAGEN.includes(ext)) {
          return cb(new BadRequestException(`Extensión no permitida: ${ext}`), false);
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_BYTES, files: MAX_FOTOS },
    }),
  )
  async subirFotos(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) monitoreoId: string,
    @UploadedFiles() archivos: Express.Multer.File[],
  ) {
    return this.service.agregarFotos(user, monitoreoId, archivos ?? []);
  }

  @Delete(':id/fotos/:fotoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarFoto(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ) {
    return this.service.eliminarFoto(user, id, fotoId);
  }
}
