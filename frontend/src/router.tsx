import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegistroPage } from '@/pages/auth/RegistroPage';
import { RutaProtegida } from '@/components/layout/RutaProtegida';

// ─── Propietario (dominio agronómico + emisiones) ────────────
import { InicioPage } from '@/pages/InicioPage';
import { EstablecimientosPage } from '@/pages/EstablecimientosPage';
import { LotesPage } from '@/pages/LotesPage';
import { CampaniasPage } from '@/pages/CampaniasPage';
import { CampaniaDetallePage } from '@/pages/CampaniaDetallePage';
import { LoteCampaniaDetallePage } from '@/pages/LoteCampaniaDetallePage';
import { CargaPage } from '@/pages/CargaPage';
import { CultivosPage } from '@/pages/CultivosPage';
import { InsumosPage } from '@/pages/InsumosPage';
import { LluviasPage } from '@/pages/LluviasPage';
import { ClimaPage } from '@/pages/ClimaPage';
import { AsistentePage } from '@/pages/AsistentePage';
import { ResumenPage } from '@/pages/ResumenPage';
import { EmisionesListPage } from '@/pages/emisiones/EmisionesListPage';
import { NuevaEmisionPage } from '@/pages/emisiones/NuevaEmisionPage';

// ─── Inversor ────────────────────────────────────────────────
import { MarketplacePage } from '@/pages/marketplace/MarketplacePage';
import { PortfolioInversorPage } from '@/pages/portfolio/PortfolioInversorPage';

// ─── Acopio ─────────────────────────────────────────────────
import { AcopioPanelPage } from '@/pages/acopio/AcopioPanelPage';

// ─── Admin ──────────────────────────────────────────────────
import { AdminPanelPage } from '@/pages/admin/AdminPanelPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegistroPage /> },

  // Rutas del propietario (y admin, que también puede entrar por soporte)
  {
    element: <RutaProtegida tipos={['propietario', 'admin']} />,
    children: [
      { path: '/', element: <InicioPage /> },
      { path: '/establecimientos', element: <EstablecimientosPage /> },
      { path: '/lotes', element: <LotesPage /> },
      { path: '/campanias', element: <CampaniasPage /> },
      { path: '/campanias/:id', element: <CampaniaDetallePage /> },
      { path: '/lotes-campania/:id', element: <LoteCampaniaDetallePage /> },
      { path: '/carga', element: <CargaPage /> },
      { path: '/lluvias', element: <LluviasPage /> },
      { path: '/clima', element: <ClimaPage /> },
      { path: '/asistente', element: <AsistentePage /> },
      { path: '/cultivos', element: <CultivosPage /> },
      { path: '/insumos', element: <InsumosPage /> },
      { path: '/resumen', element: <ResumenPage /> },
      { path: '/emisiones', element: <EmisionesListPage /> },
      { path: '/emisiones/nueva', element: <NuevaEmisionPage /> },
    ],
  },

  // Rutas del inversor
  {
    element: <RutaProtegida tipos={['inversor']} />,
    children: [
      { path: '/marketplace', element: <MarketplacePage /> },
      { path: '/portfolio', element: <PortfolioInversorPage /> },
    ],
  },

  // Rutas del acopio
  {
    element: <RutaProtegida tipos={['acopio']} />,
    children: [
      { path: '/acopio', element: <AcopioPanelPage /> },
    ],
  },

  // Rutas del admin
  {
    element: <RutaProtegida tipos={['admin']} />,
    children: [
      { path: '/admin', element: <AdminPanelPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
