import { PlaceholderPage } from '@/pages/PlaceholderPage';

export function EmisionesListPage() {
  return (
    <PlaceholderPage
      titulo="Mis emisiones"
      descripcion="Vas a ver acá las campañas que tokenizaste, con el fondeo actual y el estado."
      cta={{ label: 'Nueva emisión', to: '/emisiones/nueva' }}
    />
  );
}
