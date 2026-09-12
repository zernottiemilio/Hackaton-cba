import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HarvestLogo } from '../components/brand/HarvestLogo';

/**
 * LandingPublicaPage — página de marketing en `/` cuando no hay sesión.
 * Sin dashboards, sin tickers, sin oráculo. Solo pitch, cómo funciona,
 * números y CTA a login. Los dashboards viven en las homes por rol
 * después del login.
 */
export function LandingPublicaPage() {
  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Hero */}
      <section className="relative pt-6 pb-32">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 900,
            height: 900,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(43,224,106,0.10) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
            style={{ marginBottom: 28 }}
          >
            <HarvestLogo variant="lockup-vertical" size={64} animated tagline />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="inline-flex items-center gap-2"
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(43,224,106,0.28)',
              background: 'rgba(43,224,106,0.08)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--hv-green)',
                boxShadow: '0 0 8px rgba(43,224,106,0.8)',
              }}
            />
            <span
              className="hv-label"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.22em',
                color: 'var(--hv-green-text)',
              }}
            >
              Cosechas tokenizadas · Solana devnet
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 0.98,
              color: 'var(--hv-text)',
              marginTop: 22,
            }}
          >
            La cosecha,{' '}
            <span style={{ color: 'var(--hv-green)' }}>líquida</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            style={{
              marginTop: 28,
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--hv-text-2)',
              maxWidth: 620,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            El productor cobra hoy. El inversor cobra al cosechar. Todo asentado
            on-chain, colateralizado por producción real y validado por acopios
            habilitados.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="mt-10 flex flex-wrap gap-3 justify-center"
          >
            <Link
              to="/login"
              className="hv-cta"
              style={{
                textDecoration: 'none',
                padding: '14px 26px',
                fontSize: 15,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              Ingresar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5l7 7-7 7M20 12H4" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="hv-cta-ghost"
              style={{
                textDecoration: 'none',
                padding: '14px 26px',
                fontSize: 15,
              }}
            >
              Explorar marketplace
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
            style={{ color: 'var(--hv-text-muted)' }}
          >
            <HeroTrust label="Custodia por acopios habilitados" />
            <HeroTrust label="Liquidación atómica on-chain" />
            <HeroTrust label="USDC en vault del programa" />
          </motion.div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-16">
        <div className="text-center mb-14">
          <div className="hv-label" style={{ fontSize: 10 }}>Cómo funciona</div>
          <h2
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: 'var(--hv-text)',
              marginTop: 10,
            }}
          >
            Un contrato, tres partes, cero fricción.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PasoCard
            n="01"
            titulo="El productor tokeniza"
            descripcion="El dueño del campo declara una porción de su cosecha, elige modo (fijo o porcentual) y descuento sobre pizarra. Un admin la aprueba y aparece en el marketplace."
            icon="🌾"
          />
          <PasoCard
            n="02"
            titulo="Los inversores compran"
            descripcion="Cada tonelada se emite como un token HRV. Los inversores transfieren USDC al vault y reciben HRV en su wallet. El precio queda congelado por tenencia."
            icon="💰"
            destacado
          />
          <PasoCard
            n="03"
            titulo="Se cierra al cosechar"
            descripcion="El acopio recibe el grano, informa el precio real de liquidación. En una tx atómica se quema el HRV del inversor y se transfiere el USDC a su wallet."
            icon="✓"
          />
        </div>
      </section>

      {/* Números */}
      <section className="py-16">
        <div className="text-center mb-14">
          <div className="hv-label" style={{ fontSize: 10 }}>Ya se está tokenizando</div>
          <h2
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: 'var(--hv-text)',
              marginTop: 10,
            }}
          >
            Los números de la red.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumeroGrande valor="$4.87M" etiqueta="TVL en devnet" />
          <NumeroGrande valor="7" etiqueta="Emisiones activas" />
          <NumeroGrande valor="184" etiqueta="Wallets inversoras" />
          <NumeroGrande valor="986K" etiqueta="HRV emitidos" />
        </div>
      </section>

      {/* Diferenciales */}
      <section className="py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BeneficioCard
            titulo="Sin intermediarios"
            descripcion="El USDC entra al vault del programa. Solo el productor puede retirar contra mínimo, solo el acopio puede liquidar."
          />
          <BeneficioCard
            titulo="Custodia real"
            descripcion="Grano validado por acopios habilitados con estado SISA activo. Trazabilidad por CTG contra afectaciones vigentes."
          />
          <BeneficioCard
            titulo="Liquidación atómica"
            descripcion="Quema de tokens y transferencia de USDC en la misma transacción. Imposible cobrar dos veces, imposible perder tokens."
          />
        </div>
      </section>

      {/* CTA final */}
      <section className="pt-16">
        <div
          className="hv-glass hv-radial text-center"
          style={{ borderRadius: 24, padding: '48px 32px' }}
        >
          <HarvestLogo variant="mark" size={56} animated />
          <h2
            style={{
              color: 'var(--hv-text)',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              marginTop: 20,
            }}
          >
            Entrá con tu cuenta y empezá.
          </h2>
          <p
            style={{
              color: 'var(--hv-text-2)',
              fontSize: 14,
              marginTop: 10,
              maxWidth: 460,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Elegí tu perfil al ingresar: productor para tokenizar tu cosecha,
            inversor para comprar HRV.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              to="/login"
              className="hv-cta"
              style={{
                textDecoration: 'none',
                padding: '13px 28px',
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              Ingresar ahora
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5l7 7-7 7M20 12H4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroTrust({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontSize: 12 }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--hv-green)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {label}
    </span>
  );
}

function PasoCard({
  n,
  titulo,
  descripcion,
  icon,
  destacado,
}: {
  n: string;
  titulo: string;
  descripcion: string;
  icon: string;
  destacado?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="hv-glass"
      style={{
        borderRadius: 18,
        padding: 26,
        border: destacado
          ? '1px solid rgba(43,224,106,0.3)'
          : '1px solid var(--hv-border)',
        boxShadow: destacado
          ? '0 0 40px rgba(43,224,106,0.10), var(--hv-inset-top)'
          : 'var(--hv-inset-top)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="hv-mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: destacado ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {n}
        </span>
        <span style={{ fontSize: 26 }}>{icon}</span>
      </div>
      <h3
        style={{
          color: 'var(--hv-text)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          marginBottom: 10,
        }}
      >
        {titulo}
      </h3>
      <p style={{ color: 'var(--hv-text-2)', fontSize: 13, lineHeight: 1.6 }}>
        {descripcion}
      </p>
    </motion.div>
  );
}

function NumeroGrande({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="hv-glass" style={{ borderRadius: 16, padding: 22, textAlign: 'center' }}>
      <div
        className="hv-mono"
        style={{
          fontSize: 34,
          fontWeight: 600,
          color: 'var(--hv-text)',
          letterSpacing: '-0.025em',
          lineHeight: 1,
        }}
      >
        {valor}
      </div>
      <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 10 }}>
        {etiqueta}
      </div>
    </div>
  );
}

function BeneficioCard({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="hv-glass" style={{ borderRadius: 16, padding: 24 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(43,224,106,0.12)',
          border: '1px solid rgba(43,224,106,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--hv-green-text)',
          marginBottom: 14,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h3 style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        {titulo}
      </h3>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, lineHeight: 1.6 }}>
        {descripcion}
      </p>
    </div>
  );
}
