import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { HarvestLogo } from '../brand/HarvestLogo';

/**
 * FAB (Floating Action Button) para el shell Harvest.
 * Solo aparece cuando hay usuario autenticado (para no cubrir la landing pública).
 * Al click abre un menú con acciones rápidas: preguntar al Asistente IA,
 * crear emisión (productor), ir al marketplace, etc.
 *
 * En /asistente se oculta para no molestar el chat.
 */
export function HarvestFab() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);
  const { pathname } = useLocation();

  // No mostrar si no hay auth ni cuando está en el asistente (evitar overlap).
  if (!isAuthenticated || pathname.startsWith('/asistente') || pathname.startsWith('/login')) {
    return null;
  }

  const rol = usuario?.rolPlataforma;
  const acciones = obtenerAcciones(rol ?? null);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="fixed bottom-24 right-6 z-50"
              style={{
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 16,
                padding: 8,
                minWidth: 280,
                boxShadow: '0 30px 80px rgba(0,0,0,0.5), var(--hv-inset-top)',
              }}
            >
              <div className="hv-label" style={{ fontSize: 10, padding: '10px 12px 8px' }}>
                Acciones rápidas
              </div>
              {acciones.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  onClick={() => setOpen(false)}
                  className="hv-nav-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: 'var(--hv-text-2)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = 'var(--hv-text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--hv-text-2)';
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(43,224,106,0.10)',
                      border: '1px solid rgba(43,224,106,0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 15,
                      color: 'var(--hv-green-text)',
                      flex: 'none',
                    }}
                  >
                    {a.icon}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span>{a.titulo}</span>
                    {a.sub && (
                      <span
                        style={{
                          color: 'var(--hv-text-muted)',
                          fontSize: 11,
                          marginTop: 1,
                        }}
                      >
                        {a.sub}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--hv-green), var(--hv-green-mid))',
          color: 'var(--hv-bg-token)',
          border: 'none',
          cursor: 'pointer',
          boxShadow:
            '0 8px 24px rgba(43,224,106,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
        aria-label="Acciones rápidas"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <HarvestLogo variant="mark" size={30} />
          )}
        </motion.div>
      </motion.button>
    </>
  );
}

interface Accion {
  to: string;
  icon: string;
  titulo: string;
  sub?: string;
}

function obtenerAcciones(rol: string | null): Accion[] {
  const base: Accion[] = [
    { to: '/asistente', icon: '✦', titulo: 'Preguntar al agente', sub: 'Chat con IA sobre tu campo' },
  ];
  if (rol === 'productor') {
    base.push(
      { to: '/campanas/nueva', icon: '＋', titulo: 'Tokenizar campaña', sub: 'Wizard 4 pasos' },
      { to: '/campos/nuevo', icon: '⛰', titulo: 'Nuevo lote', sub: 'Con mapa + dibujo' },
      { to: '/alertas', icon: '⚠', titulo: 'Alertas', sub: 'Clima, vencimientos' },
    );
  }
  if (rol === 'inversor') {
    base.push(
      { to: '/invertir', icon: '⚡', titulo: 'Marketplace', sub: 'Emisiones abiertas' },
      { to: '/portfolio', icon: '▤', titulo: 'Mi portfolio', sub: 'Tenencias HRV' },
    );
  }
  if (rol === 'admin_plataforma') {
    base.push(
      { to: '/revision-emisiones', icon: '⚑', titulo: 'Cola de revisión', sub: 'Emisiones pendientes' },
    );
  }
  return base;
}
