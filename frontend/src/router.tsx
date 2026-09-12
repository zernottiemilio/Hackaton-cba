import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ActivarCuentaPage } from '@/pages/auth/ActivarCuentaPage';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { RutaSuperAdmin } from '@/components/layout/RutaSuperAdmin';
import { EstablecimientosPage } from '@/pages/EstablecimientosPage';
import { LotesPage } from '@/pages/LotesPage';
import { CampaniasPage } from '@/pages/CampaniasPage';
import { CampaniaDetallePage } from '@/pages/CampaniaDetallePage';
import { LoteCampaniaDetallePage } from '@/pages/LoteCampaniaDetallePage';
import { CultivosPage } from '@/pages/CultivosPage';
import { InsumosPage } from '@/pages/InsumosPage';
import { LluviasPage } from '@/pages/LluviasPage';
import { ClimaPage } from '@/pages/ClimaPage';
import { AsistentePage } from '@/pages/AsistentePage';
import { ResumenPage } from '@/pages/ResumenPage';
import { PropietariosPage } from '@/pages/PropietariosPage';
import { EstablecimientoDetallePage } from '@/pages/EstablecimientoDetallePage';
import { LoteDetallePage } from '@/pages/LoteDetallePage';
import { ReportesPage } from '@/pages/ReportesPage';
import { ReportePublicoPage } from '@/pages/ReportePublicoPage';
import { AlertasPage } from '@/pages/AlertasPage';
import { RankingPage } from '@/pages/RankingPage';
import { EquipoPage } from '@/pages/EquipoPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminMetricasPage } from '@/pages/admin/AdminMetricasPage';
import { AdminCuentasPage } from '@/pages/admin/AdminCuentasPage';
import { AdminCuentaDetallePage } from '@/pages/admin/AdminCuentaDetallePage';
import { AdminUsuariosPage } from '@/pages/admin/AdminUsuariosPage';
import { AdminInvitacionesPage } from '@/pages/admin/AdminInvitacionesPage';
import { AdminFacturacionPage } from '@/pages/admin/AdminFacturacionPage';

// ─── Módulo Harvest.fi (Campañas Tokenizadas) — app principal ────
import { TokenizadasLayout } from '@/modules/tokenizadas/components/layout/TokenizadasLayout';
import { HomePage as HarvestHomePage } from '@/modules/tokenizadas/pages/HomePage';
import { MarketplacePage as HarvestMarketplacePage } from '@/modules/tokenizadas/pages/MarketplacePage';
import { FichaCampanaPage as HarvestFichaCampanaPage } from '@/modules/tokenizadas/pages/FichaCampanaPage';
import { PortfolioPage as HarvestPortfolioPage } from '@/modules/tokenizadas/pages/PortfolioPage';
import { CamposListPage } from '@/modules/tokenizadas/pages/productor/CamposListPage';
import { NuevoCampoPage } from '@/modules/tokenizadas/pages/productor/NuevoCampoPage';
import { NuevaCampanaPage } from '@/modules/tokenizadas/pages/productor/NuevaCampanaPage';
import { RevisionColaPage } from '@/modules/tokenizadas/pages/admin/RevisionColaPage';
import { ProductorDetallePage } from '@/modules/tokenizadas/pages/inversor/ProductorDetallePage';
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
 * Router de la app. Harvest.fi es la app principal en la raíz `/`.
 *
 * El MVP AgroFácil quedó en sus rutas propias (`/establecimientos`, `/lotes`,
 * etc.) accesible sólo si se escribe la URL directa. Se irá removiendo en
 * commits siguientes.
 *
 * Orden importante:
 *   1. Rutas públicas (login, activar, reporte público)
 *   2. Módulo Harvest en `/*` — GANA por especificidad y orden
 *   3. Admin del MVP en `/admin-mvp` (renombrado para no chocar con Harvest)
 *   4. Rutas MVP protegidas en sus paths históricos
 *   5. Fallback `*` a la raíz
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/activar/:token', element: <ActivarCuentaPage /> },
  { path: '/r/:token', element: <ReportePublicoPage /> },

  // ─── Módulo Harvest.fi (app principal, público, se opera con wallet mock) ────
  {
    path: '/',
    element: <TokenizadasLayout />,
    children: [
      { index: true, element: <HarvestHomePage /> },
      { path: 'invertir', element: <HarvestMarketplacePage /> },
      { path: 'invertir/:id', element: <HarvestFichaCampanaPage /> },
      { path: 'portfolio', element: <HarvestPortfolioPage /> },
      { path: 'productor/:id', element: <ProductorDetallePage /> },
      { path: 'campos', element: <CamposListPage /> },
      { path: 'campos/nuevo', element: <NuevoCampoPage /> },
      { path: 'campanas', element: <MisCampanasProductorPage /> },
      { path: 'campanas/nueva', element: <NuevaCampanaPage /> },
      { path: 'acopio', element: <AcopioDashboardPage /> },
      { path: 'acopio/recepcion', element: <RecepcionPage /> },
      { path: 'acopio/posiciones', element: <PosicionesPage /> },
      { path: 'acopio/liberaciones', element: <LiberacionesPage /> },
      // Rutas de admin renombradas para no chocar con /admin del MVP legacy.
      { path: 'revision-emisiones', element: <RevisionColaPage /> },
      { path: 'red-acopios', element: <AdminAcopiosPage /> },
      { path: 'conciliacion', element: <ConciliacionPage /> },
    ],
  },

  // ─── LEGACY: Admin del MVP AgroFácil — accesible manualmente en /admin-mvp ────
  {
    path: '/admin-mvp',
    element: <RutaSuperAdmin />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'metricas', element: <AdminMetricasPage /> },
      { path: 'cuentas', element: <AdminCuentasPage /> },
      { path: 'cuentas/:id', element: <AdminCuentaDetallePage /> },
      { path: 'usuarios', element: <AdminUsuariosPage /> },
      { path: 'invitaciones', element: <AdminInvitacionesPage /> },
      { path: 'facturacion', element: <AdminFacturacionPage /> },
    ],
  },

  // ─── LEGACY: Módulo MVP AgroFácil — quedan las rutas propias por si hay que revisar ────
  {
    element: <RutaProtegida />,
    children: [
      { path: '/establecimientos', element: <EstablecimientosPage /> },
      { path: '/establecimientos/:id', element: <EstablecimientoDetallePage /> },
      { path: '/lotes', element: <LotesPage /> },
      { path: '/lotes/:id', element: <LoteDetallePage /> },
      { path: '/campanias', element: <CampaniasPage /> },
      { path: '/campanias/:id', element: <CampaniaDetallePage /> },
      { path: '/lotes-campania/:id', element: <LoteCampaniaDetallePage /> },
      { path: '/lluvias', element: <LluviasPage /> },
      { path: '/clima', element: <ClimaPage /> },
      { path: '/asistente', element: <AsistentePage /> },
      { path: '/cultivos', element: <CultivosPage /> },
      { path: '/insumos', element: <InsumosPage /> },
      { path: '/resumen', element: <ResumenPage /> },
      { path: '/ranking', element: <RankingPage /> },
      { path: '/propietarios', element: <PropietariosPage /> },
      { path: '/equipo', element: <EquipoPage /> },
      { path: '/reportes', element: <ReportesPage /> },
      { path: '/alertas', element: <AlertasPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
