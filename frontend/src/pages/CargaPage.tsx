import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ClipboardList, Mic } from 'lucide-react';
import { lotesCampaniaService } from '@/services/lotesCampaniaService';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatearFecha, formatearHa } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const colorCultivo = (nombre: string) => {
  const map: Record<string, string> = {
    soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
    maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
  };
  return map[nombre.toLowerCase()] ?? '#047C00';
};

export function CargaPage() {
  const { data } = useQuery({
    queryKey: ['lotes-campania', { limit: 100 }],
    queryFn: () => lotesCampaniaService.listar({ limit: 100 }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Registrá lo que pasa en el campo</p>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Carga rápida</h1>
      </header>

      {/* Voice hint */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-primary to-primary-deep text-white p-5 lg:p-6 flex items-start gap-4 relative overflow-hidden"
      >
        <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Mic className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">Próximamente</p>
          <h2 className="font-bold text-lg">Carga por voz y foto del anotador</h2>
          <p className="text-sm text-white/85 mt-1">
            Dictás una nota o sacás foto del cuaderno → el sistema arma el registro y vos confirmás.
            Por ahora cargá manual desde el lote.
          </p>
        </div>
      </motion.div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Elegí el lote sobre el que querés cargar
        </h2>

        {!data || data.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin lotes en campaña"
            description="Primero asigná uno o más lotes a una campaña. Después podés registrar labores e insumos."
          />
        ) : (
          <ul className="space-y-2">
            {data.items.map((lc, i) => {
              const color = colorCultivo(lc.cultivo?.nombre ?? '');
              return (
                <motion.li
                  key={lc.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025 }}
                >
                  <Link
                    to={`/lotes-campania/${lc.id}`}
                    className="group block rounded-xl bg-surface border border-border hover:border-primary/40 hover:shadow-lift transition"
                  >
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div
                        className={cn('h-2 w-2 rounded-full shrink-0')}
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {lc.lote?.nombre} · <span className="text-muted-foreground font-normal">{lc.lote?.establecimiento?.nombre}</span>
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {lc.campania?.nombre} · {lc.cultivo?.nombre} · {formatearHa(lc.superficieSembradaHa)}
                          {lc.fechaSiembra && ` · sembrado ${formatearFecha(lc.fechaSiembra)}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
