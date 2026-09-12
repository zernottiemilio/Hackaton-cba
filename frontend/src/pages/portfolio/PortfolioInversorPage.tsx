import { PlaceholderPage } from '@/pages/PlaceholderPage';

export function PortfolioInversorPage() {
  return (
    <PlaceholderPage
      titulo="Mi portfolio"
      descripcion="Vas a ver tus tenencias, el estado de cada emisión y el valor estimado al precio de mercado del día."
      cta={{ label: 'Ir al marketplace', to: '/marketplace' }}
    />
  );
}
