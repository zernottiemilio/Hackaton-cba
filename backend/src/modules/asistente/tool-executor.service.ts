import { Injectable, Logger } from '@nestjs/common';
import type { RolTokenizacion } from '@prisma/client';

import { LluviasService } from '../lluvias/lluvias.service';
import { LaboresService } from '../labores/labores.service';
import { InsumosAplicadosService } from '../insumos-aplicados/insumos-aplicados.service';
import { LotesService } from '../lotes/lotes.service';
import { LotesCampaniaService } from '../lotes-campania/lotes-campania.service';
import { ProductoresService } from '../tokenizadas/productores.service';
import { TokenizadasService } from '../tokenizadas/tokenizadas.service';

import { TOOLS_ACOPIO, TOOLS_ADMIN, TOOLS_INVERSOR, TOOLS_PRODUCTOR } from './tools';

// Mapa nombre → rol permitido. Sirve para rechazar tools que el modelo
// pueda alucinar fuera del set de su rol.
const ROL_POR_TOOL: Record<string, RolTokenizacion> = {
  ...Object.fromEntries(TOOLS_PRODUCTOR.map((t) => [t.name, 'productor' as const])),
  ...Object.fromEntries(TOOLS_INVERSOR.map((t) => [t.name, 'inversor' as const])),
  ...Object.fromEntries(TOOLS_ADMIN.map((t) => [t.name, 'admin_plataforma' as const])),
  ...Object.fromEntries(TOOLS_ACOPIO.map((t) => [t.name, 'acopio' as const])),
};

export interface ExecuteCtx {
  cuentaId: string;
  usuarioId: string;
  rol: RolTokenizacion | null | undefined;
}

/**
 * Ejecuta una tool de Claude en nombre del usuario autenticado. Cada tool
 * está atada a un rol (`ROL_POR_TOOL`); si el usuario no tiene ese rol, se
 * rechaza sin llegar a la base — defensa en profundidad frente a alucinaciones
 * del modelo. La validación de tenencia (cuentaId) la sigue haciendo cada
 * service.
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
    private readonly productores: ProductoresService,
    private readonly tokenizadas: TokenizadasService,
  ) {}

  async execute(
    name: string,
    input: Record<string, unknown>,
    ctx: ExecuteCtx,
  ): Promise<{ ok: true; resultado: unknown } | { ok: false; error: string }> {
    const rolEsperado = ROL_POR_TOOL[name];
    if (rolEsperado && ctx.rol && rolEsperado !== ctx.rol) {
      return {
        ok: false,
        error: `La tool "${name}" no está disponible para el rol "${ctx.rol}". Es del rol "${rolEsperado}".`,
      };
    }

    try {
      switch (name) {
        // ─── PRODUCTOR ───────────────────────────────────────────────
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

        // ─── INVERSOR ────────────────────────────────────────────────
        case 'consultar_historial_productor':
          return this.envolver(
            await this.productores.historial(input.productorId as string),
          );

        case 'buscar_campanas_marketplace': {
          const orden = (input.orden as
            | 'cierra_pronto'
            | 'mayor_descuento'
            | 'menor_riesgo'
            | 'recientes'
            | undefined) ?? 'cierra_pronto';
          const resultado = await this.tokenizadas.listarMarketplace({
            cultivo: input.cultivo as string | undefined,
            provincia: input.provincia as string | undefined,
            soloConGarantias: input.soloConGarantias as boolean | undefined,
            orden,
          });
          // Recortamos para no explotar el tool_result — top 10 alcanza.
          const top = Array.isArray(resultado) ? resultado.slice(0, 10) : resultado;
          return this.envolver(top);
        }

        case 'simular_retorno': {
          const tokenizacionId = input.tokenizacionId as string;
          const cantidad = Number(input.cantidadTokens ?? 100);
          return this.envolver(await this.simularRetorno(tokenizacionId, cantidad));
        }

        // ─── ADMIN ───────────────────────────────────────────────────
        case 'listar_campanas_revision':
          return this.envolver(await this.tokenizadas.listarEnRevision());

        case 'resumen_comisiones': {
          const data = await this.tokenizadas.listarComisiones({
            desde: input.desde as string | undefined,
            hasta: input.hasta as string | undefined,
          });
          // Solo el resumen — la tabla completa infla el tool_result.
          return this.envolver({
            resumen: data.resumen,
            ultimasOperaciones: data.items.slice(0, 5),
          });
        }

        default:
          return { ok: false, error: `Tool "${name}" no implementada` };
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tool ${name} falló: ${mensaje}`);
      return { ok: false, error: mensaje };
    }
  }

  /**
   * Simulación simple de retorno para una tokenización abierta. 3 escenarios:
   *   - Pesimista: cae 15% respecto del precio de referencia y solo entrega
   *     el 85% de las toneladas.
   *   - Base: entrega el 100% al precio de referencia.
   *   - Optimista: sube 20% respecto del precio de referencia.
   *
   * No pretende ser un modelo predictivo — es orientativo. El modelo lo
   * usa para explicar rango de outcomes al inversor.
   */
  private async simularRetorno(tokenizacionId: string, tokens: number) {
    const t = await this.tokenizadas.detalleCampanaMarketplace(tokenizacionId);
    const precioCompra = Number(t.precioTokenUsd);
    const precioRef = Number(t.precioReferenciaUsdTn);
    const invertidoUsd = tokens * precioCompra;

    const escenario = (precioSettlementUsd: number, cumplimientoTn: number) => {
      const payoutPorToken = precioSettlementUsd * cumplimientoTn;
      const recibidoUsd = tokens * payoutPorToken;
      const retornoUsd = recibidoUsd - invertidoUsd;
      const retornoPct = invertidoUsd > 0 ? (retornoUsd / invertidoUsd) * 100 : 0;
      return {
        precioSettlementUsdTn: precioSettlementUsd,
        cumplimientoTn,
        payoutPorTokenUsd: Number(payoutPorToken.toFixed(4)),
        recibidoUsd: Number(recibidoUsd.toFixed(2)),
        retornoUsd: Number(retornoUsd.toFixed(2)),
        retornoPct: Number(retornoPct.toFixed(2)),
      };
    };

    return {
      tokenizacionId,
      cantidadTokens: tokens,
      precioCompraUsd: precioCompra,
      invertidoUsd: Number(invertidoUsd.toFixed(2)),
      escenarios: {
        pesimista: escenario(precioRef * 0.85, 0.85),
        base: escenario(precioRef, 1.0),
        optimista: escenario(precioRef * 1.2, 1.0),
      },
      supuestos: [
        'Los tres escenarios son orientativos, no una predicción.',
        'Pesimista asume 15% de caída del precio y 85% de cumplimiento en la entrega.',
        'Base asume que se cumple lo contratado al precio de referencia.',
        'Optimista asume 20% de suba del precio y entrega completa.',
      ],
    };
  }

  private envolver(resultado: unknown): { ok: true; resultado: unknown } {
    return { ok: true, resultado };
  }
}
