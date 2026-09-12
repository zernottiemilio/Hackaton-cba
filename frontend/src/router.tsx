import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';

// ─── Módulo Harvest.fi (única app) ────────────────────────────────
import { TokenizadasLayout } from '@/modules/tokenizadas/components/layout/TokenizadasLayout';
import { RutaHarvest } from '@/modules/tokenizadas/components/layout/RutaHarvest';
import { HomePage as HarvestHomePage } from '@/modules/tokenizadas/pages/HomePage';
import { MarketplacePage as HarvestMarketplacePage } from '@/modules/tokenizadas/pages/MarketplacePage';
import { FichaCampanaPage as HarvestFichaCampanaPage } from '@/modules/tokenizadas/pages/FichaCampanaPage';
import { PortfolioPage as HarvestPortfolioPage } from '@/modules/tokenizadas/pages/PortfolioPage';
import { CamposListPage } from '@/modules/tokenizadas/pages/productor/CamposListPage';
import { NuevoCampoPage } from '@/modules/tokenizadas/pages/productor/NuevoCampoPage';
import { NuevaCampanaPage } from '@/modules/tokenizadas/pages/productor/NuevaCampanaPage';
import { MisCampanasPage } from '@/modules/tokenizadas/pages/productor/MisCampanasPage';
import { RevisionColaPage } from '@/modules/tokenizadas/pages/admin/RevisionColaPage';
import { LiquidacionPage } from '@/modules/tokenizadas/pages/admin/LiquidacionPage';
import { ComisionesPage } from '@/modules/tokenizadas/pages/admin/ComisionesPage';
import { ProductorDetallePage } from '@/modules/tokenizadas/pages/inversor/ProductorDetallePage';
import { AsistenteHarvestPage } from '@/modules/tokenizadas/pages/AsistenteHarvestPage';
import { ClimaHarvestPage } from '@/modules/tokenizadas/pages/ClimaHarvestPage';
import { LluviasHarvestPage } from '@/modules/tokenizadas/pages/LluviasHarvestPage';
import {
  AcopioDashboardPage,
  RecepcionPage,
  PosicionesPage,
  LiberacionesPage,
  AdminAcopiosPage,
  ConciliacionPage,
} from '@/modules/tokenizadas/pages/skeletons';

/**
 * Router de Harvest.fi. Todo el MVP AgroFácil fue eliminado — solo queda el
 * módulo tokenizadas + las 3 herramientas que se reutilizan (Asistente IA,
 * Clima, Lluvias) portadas al vibe Harvest.
 *
 * Rutas por rol:
 *   - Público: `/`, `/invertir`, `/invertir/:id`, `/productor/:id`
 *   - Productor: `/campos*`, `/campanas*`, `/asistente`, `/clima`, `/lluvias`
 *   - Inversor: `/portfolio`
 *   - Acopio: `/acopio*`
 *   - Admin: `/revision-emisiones`, `/red-acopios`, `/conciliacion`
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  {
    path: '/',
    element: <TokenizadasLayout />,
    children: [
      // Rutas públicas
      {
        element: <RutaHarvest publica />,
        children: [
          { index: true, element: <HarvestHomePage /> },
          { path: 'invertir', element: <HarvestMarketplacePage /> },
          { path: 'invertir/:id', element: <HarvestFichaCampanaPage /> },
          { path: 'productor/:id', element: <ProductorDetallePage /> },
        ],
      },

      // Herramientas del productor (clima, lluvias, campos, campañas)
      {
        element: <RutaHarvest roles={['productor']} />,
        children: [
          { path: 'campos', element: <CamposListPage /> },
          { path: 'campos/nuevo', element: <NuevoCampoPage /> },
          { path: 'campanas', element: <MisCampanasPage /> },
          { path: 'campanas/nueva', element: <NuevaCampanaPage /> },
          { path: 'clima', element: <ClimaHarvestPage /> },
          { path: 'lluvias', element: <LluviasHarvestPage /> },
        ],
      },

      // Asistente IA: productor e inversor comparten la misma pantalla,
      // pero el backend responde distinto según rol (system prompt + tools
      // + contexto por rol). No podemos tener dos rutas con el mismo path
      // en padres distintos: React Router matchea la primera, y si su
      // guard rechaza, no cae en la segunda.
      {
        element: <RutaHarvest roles={['productor', 'inversor']} />,
        children: [
          { path: 'asistente', element: <AsistenteHarvestPage /> },
        ],
      },

      // Inversor
      {
        element: <RutaHarvest roles={['inversor']} />,
        children: [
          { path: 'portfolio', element: <HarvestPortfolioPage /> },
        ],
      },

      // Acopio
      {
        element: <RutaHarvest roles={['acopio']} />,
        children: [
          { path: 'acopio', element: <AcopioDashboardPage /> },
          { path: 'acopio/recepcion', element: <RecepcionPage /> },
          { path: 'acopio/posiciones', element: <PosicionesPage /> },
          { path: 'acopio/liberaciones', element: <LiberacionesPage /> },
        ],
      },

      // Admin
      {
        element: <RutaHarvest roles={['admin_plataforma']} />,
        children: [
          { path: 'revision-emisiones', element: <RevisionColaPage /> },
          { path: 'liquidacion', element: <LiquidacionPage /> },
          { path: 'comisiones', element: <ComisionesPage /> },
          { path: 'red-acopios', element: <AdminAcopiosPage /> },
          { path: 'conciliacion', element: <ConciliacionPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
