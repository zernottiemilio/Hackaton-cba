/**
 * Simulador de precios en vivo: la pizarra de Rosario "fluctúa" cada 3-5s
 * con un random walk acotado. En producción, esto se reemplaza por un
 * WebSocket a la Cámara Arbitral o a MATBA.
 *
 * Cada cultivo tiene su serie propia. La UI se suscribe con `subscribe()`
 * y recibe actualizaciones. Ideal para tickers, sparklines y el gráfico
 * de pizarra en la ficha de campaña.
 */

type Cultivo = 'soja' | 'maiz' | 'trigo' | 'girasol';

interface PrecioTick {
  cultivo: Cultivo;
  usdTn: number;
  cambio24hPct: number;
  ts: number;
}

const PRECIOS_BASE: Record<Cultivo, number> = {
  soja: 310,
  maiz: 195,
  trigo: 245,
  girasol: 385,
};

const VOLATILIDAD: Record<Cultivo, number> = {
  soja: 0.008,
  maiz: 0.012,
  trigo: 0.010,
  girasol: 0.015,
};

class MockPreciosLive {
  private precios: Record<Cultivo, number> = { ...PRECIOS_BASE };
  private precioApertura: Record<Cultivo, number> = { ...PRECIOS_BASE };
  private historia: Record<Cultivo, PrecioTick[]> = {
    soja: [],
    maiz: [],
    trigo: [],
    girasol: [],
  };
  private subs = new Set<(tick: PrecioTick) => void>();
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.interval) return;
    // Pre-carga: 60 ticks históricos para arrancar los sparklines con forma.
    const cultivos: Cultivo[] = ['soja', 'maiz', 'trigo', 'girasol'];
    const ahora = Date.now();
    cultivos.forEach((c) => {
      let precio = PRECIOS_BASE[c];
      for (let i = 60; i > 0; i--) {
        precio = this.paso(precio, VOLATILIDAD[c], PRECIOS_BASE[c]);
        this.historia[c].push({
          cultivo: c,
          usdTn: precio,
          cambio24hPct: 0,
          ts: ahora - i * 60_000,
        });
      }
      this.precios[c] = precio;
      this.precioApertura[c] = this.historia[c][0].usdTn;
    });

    this.interval = setInterval(() => this.tick(), 3000 + Math.random() * 2000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  subscribe(fn: (tick: PrecioTick) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  getPrecio(cultivo: Cultivo): PrecioTick {
    const usdTn = this.precios[cultivo];
    const apertura = this.precioApertura[cultivo];
    return {
      cultivo,
      usdTn,
      cambio24hPct: ((usdTn - apertura) / apertura) * 100,
      ts: Date.now(),
    };
  }

  getHistoria(cultivo: Cultivo, cantidad = 30): PrecioTick[] {
    return this.historia[cultivo].slice(-cantidad);
  }

  getTodos(): PrecioTick[] {
    return (['soja', 'maiz', 'trigo', 'girasol'] as Cultivo[]).map((c) => this.getPrecio(c));
  }

  private tick() {
    const cultivos: Cultivo[] = ['soja', 'maiz', 'trigo', 'girasol'];
    cultivos.forEach((c) => {
      this.precios[c] = this.paso(this.precios[c], VOLATILIDAD[c], PRECIOS_BASE[c]);
      const tick = this.getPrecio(c);
      this.historia[c].push(tick);
      if (this.historia[c].length > 200) this.historia[c].shift();
      this.subs.forEach((fn) => fn(tick));
    });
  }

  /**
   * Random walk gaussiano con reversión leve a la media.
   * @param precio precio actual
   * @param vol volatilidad (porcentaje del precio como sd)
   * @param base precio de referencia hacia el que se revierte lentamente
   */
  private paso(precio: number, vol: number, base?: number): number {
    // Box–Muller para distribución normal
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const cambio = z * vol * precio;
    const objetivo = base ?? precio;
    const reversion = (objetivo - precio) * 0.02;
    return Math.max(precio * 0.7, precio + cambio + reversion);
  }
}

export const mockPreciosLive = new MockPreciosLive();

export type { PrecioTick, Cultivo };
