import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContextoTokenizacion, WalletInfo } from '../types/tokenizadas';

/**
 * Wallets fake pre-cargadas para la demo. Cada una representa un perfil
 * distinto para poder demostrar los 4 contextos sin registrarse.
 *
 * En producción, esto se reemplaza por @solana/wallet-adapter que abre
 * Phantom y devuelve la wallet real conectada por el usuario.
 */
export interface WalletDemo {
  id: string;
  nombre: string;
  address: string;
  emoji: string;
  contextos: ContextoTokenizacion[];
  descripcion: string;
  balanceSol: number;
  balanceUsdc: number;
}

export const WALLETS_DEMO: WalletDemo[] = [
  {
    id: 'productor-1',
    nombre: 'Juan Pérez',
    emoji: '🌾',
    address: '7fH2mQ9pT8gK3jN1vY4wR6bZ5cX8aE2sD9uL4nP7rQ3',
    contextos: ['productor'],
    descripcion: 'Productor · Pergamino, BA · 4 campos',
    balanceSol: 2.34,
    balanceUsdc: 12_450.75,
  },
  {
    id: 'productor-inversor-1',
    nombre: 'María González',
    emoji: '🌱',
    address: '9kJ4pL2mR8vN3qS7yT1wZ6xF9aC5uE3rD8bV2gH6nM1',
    contextos: ['productor', 'inversor'],
    descripcion: 'Productor + inversora · Marcos Juárez',
    balanceSol: 1.02,
    balanceUsdc: 34_200.0,
  },
  {
    id: 'inversor-1',
    nombre: 'Carlos Fernández',
    emoji: '💼',
    address: '3nT7bV1qR4sK8mJ5gY2wL9pF6xC8aE1rD4uH7vN2iM3',
    contextos: ['inversor'],
    descripcion: 'Inversor · Madrid · Portfolio USD',
    balanceSol: 5.87,
    balanceUsdc: 128_650.42,
  },
  {
    id: 'inversor-2',
    nombre: 'Sofía Ríos',
    emoji: '💰',
    address: '5wQ8gJ2nT7pL1mR4vS9xY6cB3aE8dF5uH2iK4bN9oM6',
    contextos: ['inversor'],
    descripcion: 'Inversora · Buenos Aires · First-time',
    balanceSol: 0.5,
    balanceUsdc: 5_000.0,
  },
  {
    id: 'acopio-1',
    nombre: 'Acopio San Martín SRL',
    emoji: '🏭',
    address: '2yR9nL5pK8vT3jS7mQ1wF4xC6aE2uH8bD5gN7iP3oV6',
    contextos: ['acopio'],
    descripcion: 'Acopio · Pergamino · 2 plantas activas',
    balanceSol: 0.15,
    balanceUsdc: 8_900.0,
  },
  {
    id: 'admin-1',
    nombre: 'Admin Plataforma',
    emoji: '🛡️',
    address: '8pM3qV6nR9jL2wT5yK1sF7bC4aE8dG2uH5iN6oX9zP1',
    contextos: ['admin_plataforma'],
    descripcion: 'Admin · Aprueba campañas · Concilia desvíos',
    balanceSol: 10.0,
    balanceUsdc: 0,
  },
];

interface WalletState {
  conectada: WalletInfo | null;
  walletDemoId: string | null;
  contextoActivo: ContextoTokenizacion | null;
  contextosDisponibles: ContextoTokenizacion[];
  historialTx: TxEntry[];

  conectar: (walletDemoId: string) => void;
  desconectar: () => void;
  cambiarContexto: (ctx: ContextoTokenizacion) => void;
  registrarTx: (tx: TxEntry) => void;
}

export interface TxEntry {
  signature: string;
  tipo: 'publicar' | 'reservar' | 'comprar' | 'reclamar';
  descripcion: string;
  usdcMovido?: number;
  timestamp: number;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      conectada: null,
      walletDemoId: null,
      contextoActivo: null,
      contextosDisponibles: [],
      historialTx: [],

      conectar: (walletDemoId) => {
        const w = WALLETS_DEMO.find((x) => x.id === walletDemoId);
        if (!w) return;
        set({
          conectada: {
            address: w.address,
            balanceSol: w.balanceSol,
            balanceUsdc: w.balanceUsdc,
            network: 'mock',
          },
          walletDemoId: w.id,
          contextosDisponibles: w.contextos,
          contextoActivo: w.contextos[0],
        });
      },

      desconectar: () =>
        set({
          conectada: null,
          walletDemoId: null,
          contextoActivo: null,
          contextosDisponibles: [],
        }),

      cambiarContexto: (ctx) => {
        const { contextosDisponibles } = get();
        if (!contextosDisponibles.includes(ctx)) return;
        set({ contextoActivo: ctx });
      },

      registrarTx: (tx) =>
        set((state) => ({
          historialTx: [tx, ...state.historialTx].slice(0, 50),
        })),
    }),
    {
      name: 'agrofacil-wallet',
    },
  ),
);

/** Helper: nombre humano de la wallet conectada. */
export function nombreWalletActiva(walletDemoId: string | null): string {
  if (!walletDemoId) return '';
  return WALLETS_DEMO.find((w) => w.id === walletDemoId)?.nombre ?? '';
}

/** Trunca una address estilo Solana Explorer: primeros 4 + ... + últimos 4. */
export function abreviarAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
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
