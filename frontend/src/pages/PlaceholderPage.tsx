import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  titulo: string;
  descripcion: string;
  cta?: { label: string; to: string };
}

/**
 * Placeholder para pantallas de los bloques 5-10 que todavía no fueron
 * implementadas. Se reemplaza cuando el bloque correspondiente entre.
 */
export function PlaceholderPage({ titulo, descripcion, cta }: PlaceholderPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="max-w-md text-center space-y-4 p-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{descripcion}</p>
        {cta && (
          <Link
            to={cta.to}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </motion.div>
  );
}
