import { Injectable, Logger } from '@nestjs/common';
import { LluviasService } from '../lluvias/lluvias.service';
import { LaboresService } from '../labores/labores.service';
import { InsumosAplicadosService } from '../insumos-aplicados/insumos-aplicados.service';
import { LotesService } from '../lotes/lotes.service';
import { LotesCampaniaService } from '../lotes-campania/lotes-campania.service';

/**
 * Ejecuta una tool de Claude en nombre del usuario autenticado.
 *
 * Cada tool delega al service correspondiente del módulo. La validación
 * de tenencia (cuentaId) se hace en cada service. Si el LLM pasa un
 * UUID que no pertenece a la cuenta, los services lanzan NotFoundException.
 *
 * El resultado se serializa para devolverlo a Claude como tool_result,
 * de modo que pueda decirle al usuario "Listo, registré X".
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly lluvias: LluviasService,
    private readonly labores: LaboresService,
    private readonly insumos: InsumosAplicadosService,
    private readonly lotes: LotesService,
    private readonly lotesCampania: LotesCampaniaService,
  ) {}

  async execute(
    name: string,
    input: Record<string, unknown>,
    ctx: { cuentaId: string },
  ): Promise<{ ok: true; resultado: unknown } | { ok: false; error: string }> {
    try {
      switch (name) {
        case 'registrar_lluvia':
          return this.envolver(await this.lluvias.registrar(ctx.cuentaId, {
            fecha: input.fecha as string,
            mm: Number(input.mm),
            establecimientoId: (input.establecimientoId as string | undefined) ?? null,
            nota: input.nota as string | undefined,
          }));

        case 'registrar_labor':
          return this.envolver(await this.labores.crear(ctx.cuentaId, {
            loteCampaniaId: input.loteCampaniaId as string,
            tipo: input.tipo as 'siembra' | 'pulverizacion' | 'fertilizacion' | 'cosecha' | 'otra',
            fecha: input.fecha as string,
            ejecutor: (input.ejecutor as 'propio' | 'contratista' | undefined) ?? 'contratista',
            costoTotalUsd: input.costoTotalUsd !== undefined ? Number(input.costoTotalUsd) : undefined,
            formaPago: input.formaPago as 'contado' | 'canje' | 'financiado' | undefined,
            nota: input.nota as string | undefined,
          }));

        case 'registrar_insumo':
          return this.envolver(await this.insumos.crear(ctx.cuentaId, {
            loteCampaniaId: input.loteCampaniaId as string,
            tipo: input.tipo as 'semilla' | 'fertilizante' | 'herbicida' | 'insecticida' | 'fungicida' | 'otro',
            producto: input.producto as string,
            cantidad: Number(input.cantidad),
            unidad: input.unidad as string,
            costoTotalUsd: Number(input.costoTotalUsd),
            formaPago: input.formaPago as 'contado' | 'canje' | 'financiado' | undefined,
          }));

        case 'actualizar_lote_campania': {
          const id = input.loteCampaniaId as string;
          const update: Record<string, unknown> = {};
          if (input.rindeEstimadoQqHa !== undefined) update.rindeEstimadoQqHa = Number(input.rindeEstimadoQqHa);
          if (input.rindeRealQqHa !== undefined) update.rindeRealQqHa = Number(input.rindeRealQqHa);
          if (input.precioGranoUsdTn !== undefined) update.precioGranoUsdTn = Number(input.precioGranoUsdTn);
          if (input.fechaSiembra !== undefined) update.fechaSiembra = input.fechaSiembra as string;
          if (input.fechaCosecha !== undefined) update.fechaCosecha = input.fechaCosecha as string;
          return this.envolver(await this.lotesCampania.actualizar(ctx.cuentaId, id, update));
        }

        case 'crear_lote':
          return this.envolver(await this.lotes.crear(ctx.cuentaId, {
            establecimientoId: input.establecimientoId as string,
            nombre: input.nombre as string,
            superficieHa: Number(input.superficieHa),
            tenencia: input.tenencia as 'propio' | 'arrendado' | 'mixto' | undefined,
            arrendamientoValor: input.arrendamientoValor !== undefined ? Number(input.arrendamientoValor) : undefined,
            arrendamientoUnidad: input.arrendamientoUnidad as 'qq_ha' | 'usd_ha' | 'pct_produccion' | undefined,
          }));

        case 'asignar_cultivo_a_campania':
          return this.envolver(await this.lotesCampania.crear(ctx.cuentaId, {
            loteId: input.loteId as string,
            campaniaId: input.campaniaId as string,
            cultivoId: input.cultivoId as string,
            superficieSembradaHa: Number(input.superficieSembradaHa),
            fechaSiembra: input.fechaSiembra as string | undefined,
            rindeEstimadoQqHa: input.rindeEstimadoQqHa !== undefined ? Number(input.rindeEstimadoQqHa) : undefined,
            precioGranoUsdTn: input.precioGranoUsdTn !== undefined ? Number(input.precioGranoUsdTn) : undefined,
          }));

        default:
          return { ok: false, error: `Tool "${name}" no implementada` };
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tool ${name} falló: ${mensaje}`);
      return { ok: false, error: mensaje };
    }
  }

  private envolver(resultado: unknown): { ok: true; resultado: unknown } {
    return { ok: true, resultado };
  }
}
