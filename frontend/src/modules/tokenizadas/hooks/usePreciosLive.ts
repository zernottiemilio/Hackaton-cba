import { useEffect, useState } from 'react';
import { mockPreciosLive, type Cultivo, type PrecioTick } from '../services/mockPreciosService';

/** Suscripción a los precios en vivo. Devuelve los 4 cultivos actualizados. */
export function usePreciosLive(): PrecioTick[] {
  const [ticks, setTicks] = useState<PrecioTick[]>(() => {
    mockPreciosLive.start();
    return mockPreciosLive.getTodos();
  });

  useEffect(() => {
    const unsub = mockPreciosLive.subscribe(() => {
      setTicks(mockPreciosLive.getTodos());
    });
    return () => unsub();
  }, []);

  return ticks;
}

/** Sólo un cultivo. Más eficiente si el componente solo mira uno. */
export function usePrecioLive(cultivo: Cultivo): PrecioTick {
  const [tick, setTick] = useState<PrecioTick>(() => {
    mockPreciosLive.start();
    return mockPreciosLive.getPrecio(cultivo);
  });

  useEffect(() => {
    const unsub = mockPreciosLive.subscribe((t) => {
      if (t.cultivo === cultivo) setTick(t);
    });
    return () => unsub();
  }, [cultivo]);

  return tick;
}

/** Serie histórica para sparklines. */
export function useHistoriaPrecios(cultivo: Cultivo, cantidad = 30): PrecioTick[] {
  const [historia, setHistoria] = useState<PrecioTick[]>(() => {
    mockPreciosLive.start();
    return mockPreciosLive.getHistoria(cultivo, cantidad);
  });

  useEffect(() => {
    const unsub = mockPreciosLive.subscribe((t) => {
      if (t.cultivo === cultivo) {
        setHistoria(mockPreciosLive.getHistoria(cultivo, cantidad));
      }
    });
    return () => unsub();
  }, [cultivo, cantidad]);

  return historia;
}
