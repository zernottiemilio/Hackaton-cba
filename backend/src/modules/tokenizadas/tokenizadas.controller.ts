import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TokenizadasService } from './tokenizadas.service';
import { CamposTokenizadasService } from './campos-tokenizadas.service';
import { ProductoresService } from './productores.service';
import {
  CrearTokenizacionDto,
  RevisarTokenizacionDto,
  CrearReservaDto,
  ConfirmarCompraDto,
  ReclamarDto,
  ListarMarketplaceDto,
} from './dto/tokenizacion.dto';
import { CrearCampoDto, ActualizarCampoDto } from './dto/campo.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RolPlataforma } from '../../common/decorators/rol-plataforma.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

/**
 * Endpoints del módulo Campañas Tokenizadas.
 * Prefijo global de la app: /api/v1.
 */
@Controller('tokenizadas')
export class TokenizadasController {
  constructor(
    private readonly service: TokenizadasService,
    private readonly camposService: CamposTokenizadasService,
    private readonly productoresService: ProductoresService,
  ) {}

  // ─── Productores (público, para vista inversor) ────────────────

  /** Listado de productores activos con rating y métricas. */
  @Public()
  @Get('productores')
  listarProductores() {
    return this.productoresService.listar();
  }

  /** Detalle de un productor con todas sus campañas + trazabilidad histórica. */
  @Public()
  @Get('productores/:id')
  detalleProductor(@Param('id') id: string) {
    return this.productoresService.detalle(id);
  }

  // ─── Catálogos (público, para popular selects del wizard) ──────

  /** Cultivos disponibles para el wizard de campaña. */
  @Public()
  @Get('cultivos')
  cultivos() {
    return this.camposService.listarCultivos();
  }

  /** Acopios aliados con convenio marco firmado. */
  @Public()
  @Get('acopios')
  acopios() {
    return this.camposService.listarAcopios();
  }

  // ─── Campos (establecimientos) del productor ───────────────────

  @Post('campos')
  crearCampo(@Usuario() user: UsuarioActual, @Body() dto: CrearCampoDto) {
    return this.camposService.crear(user.cuentaId, dto);
  }

  @Get('campos')
  listarCampos(@Usuario() user: UsuarioActual) {
    return this.camposService.listar(user.cuentaId);
  }

  @Get('campos/:id')
  detalleCampo(@Param('id') id: string, @Usuario() user: UsuarioActual) {
    return this.camposService.detalle(id, user.cuentaId);
  }

  @Patch('campos/:id')
  actualizarCampo(
    @Param('id') id: string,
    @Usuario() user: UsuarioActual,
    @Body() dto: ActualizarCampoDto,
  ) {
    return this.camposService.actualizar(id, user.cuentaId, dto);
  }

  // ─── Wallet (mock por ahora) ───────────────────────────────────

  /** "Conectar wallet Phantom" — devuelve address + balance mock. */
  @Post('wallet/conectar')
  conectarWallet(@Usuario() user: UsuarioActual) {
    return this.service.conectarWallet(user.id);
  }

  // ─── Productor ─────────────────────────────────────────────────

  /** Crear o actualizar una tokenización (wizard 4 pasos). */
  @RolPlataforma('productor')
  @Post()
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearTokenizacionDto) {
    return this.service.crear(user.id, user.cuentaId, dto);
  }

  /** Enviar a revisión ADMIN. */
  @RolPlataforma('productor')
  @Post(':id/enviar-revision')
  enviarARevision(@Param('id') id: string, @Usuario() user: UsuarioActual) {
    return this.service.enviarARevision(id, user.id);
  }

  /** Listar las campañas tokenizadas del productor autenticado. */
  @RolPlataforma('productor')
  @Get('mis-campanas')
  misCampanas(@Usuario() user: UsuarioActual) {
    return this.service.listarDelProductor(user.id);
  }

  // ─── Inversor ──────────────────────────────────────────────────

  /** Marketplace de campañas ABIERTAS. Público (no requiere auth). */
  @Public()
  @Get('marketplace')
  marketplace(@Query() filtros: ListarMarketplaceDto) {
    return this.service.listarMarketplace(filtros);
  }

  /** Detalle de una campaña en el marketplace. Público. */
  @Public()
  @Get('marketplace/:id')
  detalleMarketplace(@Param('id') id: string) {
    return this.service.detalleCampanaMarketplace(id);
  }

  /**
   * Estado on-chain de una tokenización (público). El panel on-chain de la
   * ficha y del portfolio consume este endpoint cada 10s. Contrato en
   * HARVEST.md (VAL-18).
   */
  @Public()
  @Get(':id/on-chain')
  estadoOnChain(@Param('id') id: string) {
    return this.service.obtenerEstadoOnChain(id);
  }

  /** Reservar tokens (paso 1 del sheet de compra, TTL 10 min). */
  @RolPlataforma('inversor')
  @Post('reservas')
  reservar(@Body() dto: CrearReservaDto) {
    return this.service.crearReserva(dto.tokenizacionId, dto.cantidad, dto.inversorWallet);
  }

  /** Confirmar la reserva (paso 2 → transferencia USDC → tenencia). */
  @RolPlataforma('inversor')
  @Post('reservas/confirmar')
  confirmar(@Body() dto: ConfirmarCompraDto) {
    return this.service.confirmarCompra(dto.reservaId);
  }

  /** Portfolio del inversor autenticado. */
  @RolPlataforma('inversor')
  @Get('portfolio')
  portfolio(@Usuario() user: UsuarioActual) {
    return this.service.portfolio(user.id);
  }

  /** Reclamar USDC de una tenencia liquidada (quema + payout atómico). */
  @RolPlataforma('inversor')
  @Post('reclamar')
  reclamar(@Body() dto: ReclamarDto) {
    return this.service.reclamar(dto.tenenciaId, dto.inversorWallet);
  }

  // ─── Admin ─────────────────────────────────────────────────────

  /** Cola de campañas esperando aprobación. */
  @RolPlataforma('admin_plataforma')
  @Get('admin/revision')
  colaRevision() {
    return this.service.listarEnRevision();
  }

  /** Aprobar o rechazar una tokenización. */
  @RolPlataforma('admin_plataforma')
  @Post('admin/:id/revisar')
  revisar(
    @Param('id') id: string,
    @Usuario() user: UsuarioActual,
    @Body() dto: RevisarTokenizacionDto,
  ) {
    return this.service.revisar(id, user.id, dto);
  }
}
