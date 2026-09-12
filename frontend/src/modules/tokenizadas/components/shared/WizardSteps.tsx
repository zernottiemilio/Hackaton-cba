interface Props {
  pasos: string[];
  actual: number;
}

/**
 * Barra de progreso de wizard estilo trading. Compacta, tabular,
 * con el paso activo destacado.
 */
export function WizardSteps({ pasos, actual }: Props) {
  return (
    <div className="flex items-center gap-1">
      {pasos.map((paso, i) => {
        const activo = i === actual;
        const completado = i < actual;
        return (
          <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
            <div
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                activo
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                  : completado
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              {completado ? '✓' : i + 1}
            </div>
            <div
              className={`text-xs truncate ${
                activo ? 'text-white font-medium' : completado ? 'text-white/60' : 'text-white/30'
              }`}
            >
              {paso}
            </div>
            {i < pasos.length - 1 && (
              <div
                className={`flex-1 h-px transition-colors ${completado ? 'bg-emerald-500/40' : 'bg-white/5'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
