import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/stores/authStore';
import { tokenizadasApi } from '../services/tokenizadasService';
import type { ContextoTokenizacion, WalletInfo } from '../types/tokenizadas';

/**
 * Wallet custodial del usuario autenticado.
 *
 * Modelo: el backend genera y custodia un keypair por usuario y firma las
 * transacciones por él. No hay Phantom ni wallet-adapter. "Conectar" es
 * pedirle al backend la wallet del usuario logueado (`POST /tokenizadas/wallet/conectar`),
 * que la crea y la fondea la primera vez.
 *
 * El rol (productor / inversor / admin) NO sale de la wallet: sale de
 * `usuario.rolPlataforma` del authStore. Ver `useContextoActivo`.
 */

export interface TxEntry {
  signature: string;
  tipo: 'publicar' | 'reservar' | 'comprar' | 'reclamar' | 'liberar' | 'liquidar' | 'fee';
  descripcion: string;
  usdcMovido?: number;
  timestamp: number;
}

interface WalletState {
  conectada: WalletInfo | null;
  conectando: boolean;
  error: string | null;
  historialTx: TxEntry[];

  /** Pide la wallet custodial al backend. Requiere sesión iniciada. */
  conectar: () => Promise<void>;
  /** Vuelve a pedir balances. Mismo endpoint, la wallet ya existe. */
  refrescar: () => Promise<void>;
  desconectar: () => void;
  registrarTx: (tx: TxEntry) => void;
}

/** Lo único que va a localStorage. `conectando` y `error` son efímeros. */
type WalletPersistido = Pick<WalletState, 'conectada' | 'historialTx'>;

/**
 * El store nunca guarda una wallet con forma inválida. Si el backend devuelve
 * algo inesperado (por ejemplo una página de error con status 200 durante un
 * redeploy), tiramos y el caller conserva el estado anterior. Sin esto, un
 * `balanceUsdc` ausente terminaba en "US$ NaN" en el topbar.
 */
function validarWallet(raw: unknown): WalletInfo {
  const w = raw as Partial<WalletInfo> | null;
  if (
    !w ||
    typeof w.address !== 'string' ||
    w.address.length < 32 ||
    typeof w.balanceSol !== 'number' ||
    !Number.isFinite(w.balanceSol) ||
    typeof w.balanceUsdc !== 'number' ||
    !Number.isFinite(w.balanceUsdc) ||
    (w.network !== 'devnet' && w.network !== 'mainnet-beta' && w.network !== 'mock')
  ) {
    throw new Error('Respuesta de wallet inválida');
  }
  return { address: w.address, balanceSol: w.balanceSol, balanceUsdc: w.balanceUsdc, network: w.network };
}

const mensajeError = (e: unknown): string => {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { message?: string | string[] } } }).response;
    const m = r?.data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  }
  return e instanceof Error ? e.message : 'No pudimos conectar la wallet';
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      conectada: null,
      conectando: false,
      error: null,
      historialTx: [],

      conectar: async () => {
        if (get().conectando) return;
        set({ conectando: true, error: null });
        try {
          const wallet = validarWallet(await tokenizadasApi.conectarWallet());
          set({ conectada: wallet, conectando: false });
        } catch (e) {
          set({ conectando: false, error: mensajeError(e) });
          throw e;
        }
      },

      refrescar: async () => {
        if (!get().conectada || get().conectando) return;
        try {
          const wallet = validarWallet(await tokenizadasApi.conectarWallet());
          set({ conectada: wallet });
        } catch {
          /* balances viejos son mejor que nada; no rompemos la UI por un refresh */
        }
      },

      desconectar: () => set({ conectada: null, error: null }),

      registrarTx: (tx) =>
        set((state) => ({
          historialTx: [tx, ...state.historialTx].slice(0, 50),
        })),
    }),
    {
      name: 'agrofacil-wallet',
      // v1 persistía WALLETS_DEMO (address falsa, network 'mock'). Al subir a v2
      // se descarta todo lo viejo: la wallet real se pide de nuevo al backend.
      version: 2,
      migrate: (persisted, version): WalletPersistido => {
        if (version < 2) return { conectada: null, historialTx: [] };
        const p = persisted as Partial<WalletPersistido>;
        return { conectada: p.conectada ?? null, historialTx: p.historialTx ?? [] };
      },
      partialize: (state) => ({
        conectada: state.conectada,
        historialTx: state.historialTx,
      }),
    },
  ),
);

/** Rol activo en Harvest. Viene del usuario autenticado, no de la wallet. */
export function useContextoActivo(): ContextoTokenizacion | null {
  return useAuthStore((s) => s.usuario?.rolPlataforma ?? null);
}

/** Nombre humano para mostrar junto a la wallet: el del usuario logueado. */
export function useNombreWallet(): string {
  return useAuthStore((s) => s.usuario?.nombre ?? '');
}

export function nombreContexto(ctx: ContextoTokenizacion): string {
  switch (ctx) {
    case 'productor':
      return 'Productor';
    case 'inversor':
      return 'Inversor';
    case 'acopio':
      return 'Acopio';
    case 'admin_plataforma':
      return 'Admin';
  }
}
