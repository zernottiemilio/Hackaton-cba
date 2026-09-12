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
import { RevisionColaPage } from '@/modules/tokenizadas/pages/admin/RevisionColaPage';
import { ProductorDetallePage } from '@/modules/tokenizadas/pages/inversor/ProductorDetallePage';
import { AsistenteHarvestPage } from '@/modules/tokenizadas/pages/AsistenteHarvestPage';
import { ClimaHarvestPage } from '@/modules/tokenizadas/pages/ClimaHarvestPage';
import { LluviasHarvestPage } from '@/modules/tokenizadas/pages/LluviasHarvestPage';
import {
  MisCampanasProductorPage,
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

      // Herramientas del productor (chat IA, clima, lluvias)
      {
        element: <RutaHarvest roles={['productor']} />,
        children: [
          { path: 'campos', element: <CamposListPage /> },
          { path: 'campos/nuevo', element: <NuevoCampoPage /> },
          { path: 'campanas', element: <MisCampanasProductorPage /> },
          { path: 'campanas/nueva', element: <NuevaCampanaPage /> },
          { path: 'asistente', element: <AsistenteHarvestPage /> },
          { path: 'clima', element: <ClimaHarvestPage /> },
          { path: 'lluvias', element: <LluviasHarvestPage /> },
        ],
      },

      // Inversor
      {
        element: <RutaHarvest roles={['inversor']} />,
        children: [
          { path: 'portfolio', element: <HarvestPortfolioPage /> },
          // El asistente también sirve al inversor
          { path: 'asistente', element: <AsistenteHarvestPage /> },
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
          { path: 'red-acopios', element: <AdminAcopiosPage /> },
          { path: 'conciliacion', element: <ConciliacionPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
