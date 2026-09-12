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
  Query,
} from '@nestjs/common';
import { VariedadesService } from './variedades.service';
import { ActualizarVariedadDto, CrearVariedadDto, listarVariedadesSchema } from './variedades.dto';

@Controller('variedades')
export class VariedadesController {
  constructor(private readonly service: VariedadesService) {}

  @Get()
  listar(@Query() query: Record<string, string>) {
    return this.service.listar(listarVariedadesSchema.parse(query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() dto: CrearVariedadDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarVariedadDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
