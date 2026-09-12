import { useWalletStore, nombreContexto } from '../../stores/walletStore';
import type { ContextoTokenizacion } from '../../types/tokenizadas';

const COLOR_CONTEXTO: Record<ContextoTokenizacion, string> = {
  productor: 'from-emerald-500 to-emerald-600',
  inversor: 'from-sky-500 to-indigo-600',
  acopio: 'from-amber-500 to-orange-600',
  admin_plataforma: 'from-purple-500 to-fuchsia-600',
};

/**
 * Switch de contexto para usuarios que tienen múltiples roles.
 * Aparece solo si el usuario tiene 2+ contextos disponibles.
 * En una wallet con solo un rol, no se muestra.
 */
export function SwitchContexto() {
  const { contextoActivo, contextosDisponibles, cambiarContexto } = useWalletStore();
  if (contextosDisponibles.length < 2 || !contextoActivo) return null;

  return (
    <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-1 gap-0.5">
      {contextosDisponibles.map((ctx) => {
        const activo = ctx === contextoActivo;
        return (
          <button
            key={ctx}
            onClick={() => cambiarContexto(ctx)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activo
                ? `bg-gradient-to-br ${COLOR_CONTEXTO[ctx]} text-white shadow-lg`
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {nombreContexto(ctx)}
          </button>
        );
      })}
    </div>
  );
}
