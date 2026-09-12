import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seed AgroFacil...');

  await seedSuperadmin();
  await seedDemo();
  await seedCultivos();
  await seedTokenizadas();
}

/// Crea (o actualiza) el superadmin de la plataforma a partir de variables de entorno.
/// Si SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD no están seteados, salta este paso con un warning.
async function seedSuperadmin(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD;
  const nombre = process.env.SUPERADMIN_NOMBRE?.trim() ?? 'Superadmin';

  if (!email || !password) {
    console.warn('⚠  SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD no seteados — salto el seed del superadmin.');
    return;
  }

  // El superadmin necesita una Cuenta legacy por el FK histórico de Usuario.cuentaId.
  // Creamos una cuenta "Plataforma" interna que no se usa para datos agro reales.
  const cuentaPlataforma = await prisma.cuenta.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000ff' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000ff',
      nombre: 'Plataforma AgroFácil',
      emailContacto: email,
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {
      passwordHash,
      rolGlobal: 'superadmin',
      activo: true,
    },
    create: {
      email,
      passwordHash,
      nombre,
      rolGlobal: 'superadmin',
      cuentaId: cuentaPlataforma.id,
    },
  });

  // Membresía en la cuenta plataforma para satisfacer el chequeo de membresía del login.
  await prisma.usuarioCuenta.upsert({
    where: { usuarioId_cuentaId: { usuarioId: usuario.id, cuentaId: cuentaPlataforma.id } },
    update: { activo: true },
    create: {
      usuarioId: usuario.id,
      cuentaId: cuentaPlataforma.id,
      rol: 'ingeniero',
    },
  });

  console.log(`✓ Superadmin: ${usuario.email}`);
}

async function seedDemo(): Promise<void> {
  const cuenta = await prisma.cuenta.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Campo Demo',
      emailContacto: 'demo@agrofacil.dev',
    },
  });

  const passwordHash = await bcrypt.hash('agrofacil123', 12);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'demo@agrofacil.dev' },
    update: {},
    create: {
      cuentaId: cuenta.id,
      email: 'demo@agrofacil.dev',
      passwordHash,
      nombre: 'Productor Demo',
    },
  });

  await prisma.usuarioCuenta.upsert({
    where: { usuarioId_cuentaId: { usuarioId: usuario.id, cuentaId: cuenta.id } },
    update: { activo: true },
    create: { usuarioId: usuario.id, cuentaId: cuenta.id, rol: 'ingeniero' },
  });

  console.log(`✓ Cuenta demo: ${cuenta.nombre}`);
  console.log(`✓ Usuario demo: ${usuario.email} / agrofacil123`);
}

async function seedCultivos(): Promise<void> {
  const cultivos = ['soja', 'trigo', 'maíz', 'girasol', 'sorgo'];
  for (const nombre of cultivos) {
    await prisma.cultivo.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log(`✓ Cultivos: ${cultivos.join(', ')}`);
}

// ─── Seed del módulo Campañas Tokenizadas ─────────────────────────
//
// Genera un ecosistema completo para demo:
// - 2 acopios aliados con 3 plantas
// - 6 usuarios con wallets fake (productor, productor+inversor, inversores,
//   acopio, admin)
// - 4 establecimientos con geometría real de zona núcleo
// - 7 campañas en TODOS los estados (borrador, revisión, abierta con distintos
//   niveles de fondeo, en curso, liquidada bien y mal)
// - 1 tokenización FIJO y 1 PORCENTUAL como mínimo
// - Tenencias de los inversores para llenar sus portfolios

// Wallets fake — deben coincidir con WALLETS_DEMO en el frontend
// (frontend/src/modules/tokenizadas/stores/walletStore.ts) para que al
// "conectar wallet" en la demo se identifique al usuario en Postgres.
const WALLETS = {
  productor1: '7fH2mQ9pT8gK3jN1vY4wR6bZ5cX8aE2sD9uL4nP7rQ3',
  productorInversor1: '9kJ4pL2mR8vN3qS7yT1wZ6xF9aC5uE3rD8bV2gH6nM1',
  inversor1: '3nT7bV1qR4sK8mJ5gY2wL9pF6xC8aE1rD4uH7vN2iM3',
  inversor2: '5wQ8gJ2nT7pL1mR4vS9xY6cB3aE8dF5uH2iK4bN9oM6',
  acopio1: '2yR9nL5pK8vT3jS7mQ1wF4xC6aE2uH8bD5gN7iP3oV6',
  admin1: '8pM3qV6nR9jL2wT5yK1sF7bC4aE8dG2uH5iN6oX9zP1',
};

// Polígonos aproximados de zona núcleo (coordenadas reales)
const POLIGONOS = {
  laEscondida: {
    type: 'Polygon',
    coordinates: [
      [
        [-60.62, -33.88],
        [-60.60, -33.87],
        [-60.58, -33.88],
        [-60.58, -33.90],
        [-60.61, -33.91],
        [-60.63, -33.90],
        [-60.62, -33.88],
      ],
    ],
  },
  losAlamos: {
    type: 'Polygon',
    coordinates: [
      [
        [-62.12, -32.68],
        [-62.09, -32.68],
        [-62.08, -32.70],
        [-62.09, -32.72],
        [-62.12, -32.71],
        [-62.13, -32.69],
        [-62.12, -32.68],
      ],
    ],
  },
  donBosco: {
    type: 'Polygon',
    coordinates: [
      [
        [-64.32, -33.10],
        [-64.30, -33.09],
        [-64.28, -33.10],
        [-64.28, -33.12],
        [-64.30, -33.13],
        [-64.32, -33.12],
        [-64.32, -33.10],
      ],
    ],
  },
  elPeral: {
    type: 'Polygon',
    coordinates: [
      [
        [-60.72, -34.20],
        [-60.70, -34.19],
        [-60.68, -34.20],
        [-60.68, -34.22],
        [-60.70, -34.23],
        [-60.72, -34.22],
        [-60.72, -34.20],
      ],
    ],
  },
};

async function seedTokenizadas(): Promise<void> {
  // ─── Cultivos (obtener referencias) ─────────────────────────
  const soja = await prisma.cultivo.findUnique({ where: { nombre: 'soja' } });
  const maiz = await prisma.cultivo.findUnique({ where: { nombre: 'maíz' } });
  const trigo = await prisma.cultivo.findUnique({ where: { nombre: 'trigo' } });
  const girasol = await prisma.cultivo.findUnique({ where: { nombre: 'girasol' } });
  if (!soja || !maiz || !trigo || !girasol) {
    throw new Error('Faltan cultivos base — asegurate de correr seedCultivos primero');
  }

  // ─── Acopios ────────────────────────────────────────────────
  const acopioSanMartin = await prisma.acopio.upsert({
    where: { cuit: '30-71234567-8' },
    update: {},
    create: {
      razonSocial: 'Acopio San Martín SRL',
      cuit: '30-71234567-8',
      sisaEstado: 'uno',
      sisaUltimaVerificacion: new Date(),
      convenioMarcoFirmado: true,
      convenioUrl: '/uploads/convenios/san-martin-2026.pdf',
      nivelIntegracion: 'portal',
      telefono: '+54 2477 456789',
      email: 'operaciones@acopiosanmartin.com.ar',
    },
  });
  const acopioDelSur = await prisma.acopio.upsert({
    where: { cuit: '30-70987654-3' },
    update: {},
    create: {
      razonSocial: 'Acopio Del Sur SA',
      cuit: '30-70987654-3',
      sisaEstado: 'dos',
      sisaUltimaVerificacion: new Date(),
      convenioMarcoFirmado: true,
      nivelIntegracion: 'manual',
      telefono: '+54 3472 234567',
      email: 'admin@delsur.com.ar',
    },
  });

  // ─── Plantas ────────────────────────────────────────────────
  const plantaSanMartinCentral = await prisma.planta.upsert({
    where: { numeroPlantaSisa: 'PL-BS-034521' },
    update: {},
    create: {
      acopioId: acopioSanMartin.id,
      numeroPlantaSisa: 'PL-BS-034521',
      nombre: 'San Martín Central',
      localidad: 'Pergamino',
      provincia: 'Buenos Aires',
      latitud: -33.89,
      longitud: -60.58,
      capacidadTn: 25000,
    },
  });
  await prisma.planta.upsert({
    where: { numeroPlantaSisa: 'PL-BS-034522' },
    update: {},
    create: {
      acopioId: acopioSanMartin.id,
      numeroPlantaSisa: 'PL-BS-034522',
      nombre: 'San Martín Rojas',
      localidad: 'Rojas',
      provincia: 'Buenos Aires',
      latitud: -34.19,
      longitud: -60.72,
      capacidadTn: 15000,
    },
  });
  await prisma.planta.upsert({
    where: { numeroPlantaSisa: 'PL-CB-041289' },
    update: {},
    create: {
      acopioId: acopioDelSur.id,
      numeroPlantaSisa: 'PL-CB-041289',
      nombre: 'Del Sur Marcos Juárez',
      localidad: 'Marcos Juárez',
      provincia: 'Córdoba',
      latitud: -32.70,
      longitud: -62.10,
      capacidadTn: 32000,
    },
  });

  // ─── Cuenta demo (reusar la que crea seedDemo) ──────────────
  const cuentaDemo = await prisma.cuenta.findUniqueOrThrow({
    where: { id: '00000000-0000-0000-0000-000000000001' },
  });

  // ─── Usuarios con wallets fake ──────────────────────────────
  const passwordHash = await bcrypt.hash('agrofacil123', 12);
  const productorJuan = await prisma.usuario.upsert({
    where: { email: 'juan@productor.demo' },
    update: {
      walletAddress: WALLETS.productor1,
      contextosTokenizacion: ['productor'],
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'juan@productor.demo',
      passwordHash,
      nombre: 'Juan Pérez',
      walletAddress: WALLETS.productor1,
      contextosTokenizacion: ['productor'],
    },
  });

  const productorInversorMaria = await prisma.usuario.upsert({
    where: { email: 'maria@productor.demo' },
    update: {
      walletAddress: WALLETS.productorInversor1,
      contextosTokenizacion: ['productor', 'inversor'],
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'maria@productor.demo',
      passwordHash,
      nombre: 'María González',
      walletAddress: WALLETS.productorInversor1,
      contextosTokenizacion: ['productor', 'inversor'],
    },
  });

  const inversorCarlos = await prisma.usuario.upsert({
    where: { email: 'carlos@inversor.demo' },
    update: {
      walletAddress: WALLETS.inversor1,
      contextosTokenizacion: ['inversor'],
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'carlos@inversor.demo',
      passwordHash,
      nombre: 'Carlos Fernández',
      walletAddress: WALLETS.inversor1,
      contextosTokenizacion: ['inversor'],
    },
  });

  const inversorSofia = await prisma.usuario.upsert({
    where: { email: 'sofia@inversor.demo' },
    update: {
      walletAddress: WALLETS.inversor2,
      contextosTokenizacion: ['inversor'],
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'sofia@inversor.demo',
      passwordHash,
      nombre: 'Sofía Ríos',
      walletAddress: WALLETS.inversor2,
      contextosTokenizacion: ['inversor'],
    },
  });

  // Usuario acopio (pertenece al acopio San Martín)
  await prisma.usuario.upsert({
    where: { email: 'acopio@sanmartin.demo' },
    update: {
      walletAddress: WALLETS.acopio1,
      contextosTokenizacion: ['acopio'],
      acopioId: acopioSanMartin.id,
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'acopio@sanmartin.demo',
      passwordHash,
      nombre: 'Operador San Martín',
      walletAddress: WALLETS.acopio1,
      contextosTokenizacion: ['acopio'],
      acopioId: acopioSanMartin.id,
    },
  });

  // Admin plataforma
  await prisma.usuario.upsert({
    where: { email: 'admin@tokenizadas.demo' },
    update: {
      walletAddress: WALLETS.admin1,
      contextosTokenizacion: ['admin_plataforma'],
    },
    create: {
      cuentaId: cuentaDemo.id,
      email: 'admin@tokenizadas.demo',
      passwordHash,
      nombre: 'Admin Plataforma',
      walletAddress: WALLETS.admin1,
      contextosTokenizacion: ['admin_plataforma'],
    },
  });

  // ─── Establecimientos con geometría ─────────────────────────
  const campoEscondida = await prisma.establecimiento.upsert({
    where: { id: '00000000-1000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-1000-0000-0000-000000000001',
      cuentaId: cuentaDemo.id,
      nombre: 'La Escondida',
      superficieTotalHa: 240,
      latitud: -33.89,
      longitud: -60.60,
      partido: 'Pergamino',
      provincia: 'Buenos Aires',
      geometria: POLIGONOS.laEscondida as any,
      acopioHabitualId: acopioSanMartin.id,
      tenencia: 'propio',
    },
  });
  const campoAlamos = await prisma.establecimiento.upsert({
    where: { id: '00000000-1000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-1000-0000-0000-000000000002',
      cuentaId: cuentaDemo.id,
      nombre: 'Los Álamos',
      superficieTotalHa: 380,
      latitud: -32.70,
      longitud: -62.10,
      partido: 'Marcos Juárez',
      provincia: 'Córdoba',
      geometria: POLIGONOS.losAlamos as any,
      acopioHabitualId: acopioDelSur.id,
      tenencia: 'arrendado',
    },
  });
  const campoBosco = await prisma.establecimiento.upsert({
    where: { id: '00000000-1000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-1000-0000-0000-000000000003',
      cuentaId: cuentaDemo.id,
      nombre: 'Don Bosco',
      superficieTotalHa: 165,
      latitud: -33.10,
      longitud: -64.30,
      partido: 'Río Cuarto',
      provincia: 'Córdoba',
      geometria: POLIGONOS.donBosco as any,
      tenencia: 'propio',
    },
  });
  const campoPeral = await prisma.establecimiento.upsert({
    where: { id: '00000000-1000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-1000-0000-0000-000000000004',
      cuentaId: cuentaDemo.id,
      nombre: 'El Peral',
      superficieTotalHa: 420,
      latitud: -34.20,
      longitud: -60.70,
      partido: 'Rojas',
      provincia: 'Buenos Aires',
      geometria: POLIGONOS.elPeral as any,
      acopioHabitualId: acopioSanMartin.id,
      tenencia: 'propio',
    },
  });

  // ─── Campañas + tokenizaciones ──────────────────────────────
  // Helper para crear campaña + tokenización + eventualmente tenencias.
  const crearCampana = async (params: {
    id: string;
    productorId: string;
    establecimientoId: string;
    cultivoId: string;
    nombre: string;
    cicloAgricola: string;
    hectareas: number;
    rindeEstimado: number;
    fechaSiembra: Date;
    fechaCosecha: Date;
    estado: 'borrador' | 'en_revision' | 'abierta' | 'fondeada' | 'en_curso' | 'liquidada' | 'rechazada';
    modo: 'fijo' | 'porcentual';
    valorModo: number;
    precioReferencia: number;
    descuentoPct: number;
    fondeoDesde: Date;
    fondeoHasta: Date;
    tokensVendidos?: number;
    seguroGranizo?: boolean;
    seguroParametrico?: boolean;
    avalSgr?: boolean;
    precioLiquidacion?: number;
    fechaLiquidacion?: Date;
    tenencias?: { inversorId: string; walletAddress: string; tokens: number }[];
  }) => {
    const campania = await prisma.campania.upsert({
      where: { id: params.id },
      update: {},
      create: {
        id: params.id,
        cuentaId: cuentaDemo.id,
        nombre: params.nombre,
        establecimientoId: params.establecimientoId,
        cultivoId: params.cultivoId,
        cicloAgricola: params.cicloAgricola,
        hectareasAfectadas: params.hectareas,
        fechaSiembraEstimada: params.fechaSiembra,
        fechaCosechaEstimada: params.fechaCosecha,
        rindeEstimadoTnHa: params.rindeEstimado,
        fechaInicio: params.fechaSiembra,
        fechaFin: params.fechaCosecha,
        estadoToken: params.estado,
      },
    });

    const produccionEstimadaTn = params.hectareas * params.rindeEstimado;
    const toneladasOfrecidas =
      params.modo === 'porcentual'
        ? (produccionEstimadaTn * params.valorModo) / 100
        : params.valorModo;
    const precioToken = params.precioReferencia * (1 - params.descuentoPct / 100);
    const montoObjetivoUsd = toneladasOfrecidas * precioToken;
    const tokensVendidos = params.tokensVendidos ?? 0;

    await prisma.tokenizacionCampana.upsert({
      where: { campaniaId: campania.id },
      update: {},
      create: {
        campaniaId: campania.id,
        productorId: params.productorId,
        modo: params.modo,
        porcentaje: params.modo === 'porcentual' ? params.valorModo : null,
        toneladasFijas: params.modo === 'fijo' ? params.valorModo : null,
        toneladasOfrecidas,
        tokensEmitidos: toneladasOfrecidas,
        tokensVendidos,
        fuentePrecio: 'pizarra_rosario',
        precioReferenciaUsdTn: params.precioReferencia,
        descuentoPct: params.descuentoPct,
        precioTokenUsd: precioToken,
        precioDinamico: false,
        fondeoDesde: params.fondeoDesde,
        fondeoHasta: params.fondeoHasta,
        montoObjetivoUsd,
        montoRecaudadoUsd: tokensVendidos * precioToken,
        tieneSeguroGranizo: params.seguroGranizo ?? false,
        tieneSeguroParametrico: params.seguroParametrico ?? false,
        tieneAvalSgr: params.avalSgr ?? false,
        sobrecolateralPct: 0,
        mintAddress: params.estado === 'borrador' || params.estado === 'en_revision' || params.estado === 'rechazada' ? null : `MINT${Math.random().toString(36).slice(2, 42)}`.padEnd(44, 'A'),
        vaultAddress: params.estado === 'borrador' || params.estado === 'en_revision' || params.estado === 'rechazada' ? null : `VLT${Math.random().toString(36).slice(2, 42)}`.padEnd(44, 'B'),
        txSignaturePublicacion: params.estado === 'borrador' || params.estado === 'en_revision' || params.estado === 'rechazada' ? null : `${Math.random().toString(36).slice(2, 44)}${Math.random().toString(36).slice(2, 44)}`.padEnd(88, 'C'),
        aprobadaEn: params.estado === 'borrador' || params.estado === 'en_revision' || params.estado === 'rechazada' ? null : new Date(params.fondeoDesde.getTime() - 5 * 24 * 3600 * 1000),
        precioLiquidacionUsdTn: params.precioLiquidacion,
        fechaLiquidacion: params.fechaLiquidacion,
      },
    });

    // Crear tenencias
    for (const t of params.tenencias ?? []) {
      const precioCompra = precioToken;
      const monto = t.tokens * precioCompra;
      await prisma.tenenciaToken.create({
        data: {
          tokenizacionId: (await prisma.tokenizacionCampana.findUniqueOrThrow({ where: { campaniaId: campania.id } })).id,
          inversorId: t.inversorId,
          walletAddress: t.walletAddress,
          tokens: t.tokens,
          precioCompraUsd: precioCompra,
          montoTotalUsd: monto,
          txSignatureCompra: `${Math.random().toString(36).slice(2, 44)}${Math.random().toString(36).slice(2, 44)}`.padEnd(88, 'D'),
          estado: params.estado === 'liquidada' ? 'liquidada' : 'activa',
          usdcRecibido: params.estado === 'liquidada' && params.precioLiquidacion
            ? t.tokens * params.precioLiquidacion
            : null,
          fechaCobro: params.estado === 'liquidada' ? params.fechaLiquidacion : null,
        },
      });
    }
  };

  const hoy = new Date();
  const en = (dias: number) => new Date(hoy.getTime() + dias * 24 * 3600 * 1000);
  const hace = (dias: number) => new Date(hoy.getTime() - dias * 24 * 3600 * 1000);

  // Limpiar tenencias previas para no duplicar (idempotencia)
  await prisma.tenenciaToken.deleteMany({});

  // 1. Borrador — el productor la está armando
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000001',
    productorId: productorJuan.id,
    establecimientoId: campoEscondida.id,
    cultivoId: soja.id,
    nombre: 'La Escondida · Soja 2026/27',
    cicloAgricola: '2026/27',
    hectareas: 240,
    rindeEstimado: 3.6,
    fechaSiembra: en(45),
    fechaCosecha: en(240),
    estado: 'borrador',
    modo: 'fijo',
    valorModo: 300,
    precioReferencia: 310,
    descuentoPct: 7,
    fondeoDesde: en(15),
    fondeoHasta: en(45),
    seguroGranizo: true,
  });

  // 2. En revisión — esperando ADMIN
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000002',
    productorId: productorInversorMaria.id,
    establecimientoId: campoAlamos.id,
    cultivoId: maiz.id,
    nombre: 'Los Álamos · Maíz 2026/27',
    cicloAgricola: '2026/27',
    hectareas: 380,
    rindeEstimado: 8.2,
    fechaSiembra: en(30),
    fechaCosecha: en(210),
    estado: 'en_revision',
    modo: 'porcentual',
    valorModo: 25,
    precioReferencia: 195,
    descuentoPct: 5,
    fondeoDesde: en(20),
    fondeoHasta: en(50),
    seguroGranizo: true,
    avalSgr: true,
  });

  // 3. Abierta con fondeo bajo (recién publicada)
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000003',
    productorId: productorJuan.id,
    establecimientoId: campoBosco.id,
    cultivoId: girasol.id,
    nombre: 'Don Bosco · Girasol 2026/27',
    cicloAgricola: '2026/27',
    hectareas: 165,
    rindeEstimado: 2.4,
    fechaSiembra: en(20),
    fechaCosecha: en(180),
    estado: 'abierta',
    modo: 'porcentual',
    valorModo: 40,
    precioReferencia: 385,
    descuentoPct: 12,
    fondeoDesde: hace(3),
    fondeoHasta: en(25),
    tokensVendidos: 32, // ~20% fondeado sobre 158 tokens
    seguroParametrico: true,
    tenencias: [
      { inversorId: inversorCarlos.id, walletAddress: WALLETS.inversor1, tokens: 20 },
      { inversorId: inversorSofia.id, walletAddress: WALLETS.inversor2, tokens: 12 },
    ],
  });

  // 4. Abierta con fondeo alto — 95%, cierra pronto (URGENCIA)
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000004',
    productorId: productorInversorMaria.id,
    establecimientoId: campoPeral.id,
    cultivoId: soja.id,
    nombre: 'El Peral · Soja 2026/27',
    cicloAgricola: '2026/27',
    hectareas: 420,
    rindeEstimado: 3.9,
    fechaSiembra: en(35),
    fechaCosecha: en(230),
    estado: 'abierta',
    modo: 'fijo',
    valorModo: 500,
    precioReferencia: 310,
    descuentoPct: 6,
    fondeoDesde: hace(20),
    fondeoHasta: en(1), // cierra en 24h
    tokensVendidos: 475, // 95%
    seguroGranizo: true,
    seguroParametrico: true,
    avalSgr: true,
    tenencias: [
      { inversorId: inversorCarlos.id, walletAddress: WALLETS.inversor1, tokens: 300 },
      { inversorId: inversorSofia.id, walletAddress: WALLETS.inversor2, tokens: 75 },
      { inversorId: productorInversorMaria.id, walletAddress: WALLETS.productorInversor1, tokens: 100 },
    ],
  });

  // 5. En curso — sembrada, creciendo (NDVI cayendo mock)
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000005',
    productorId: productorJuan.id,
    establecimientoId: campoEscondida.id,
    cultivoId: trigo.id,
    nombre: 'La Escondida · Trigo 2026',
    cicloAgricola: '2026',
    hectareas: 180,
    rindeEstimado: 4.5,
    fechaSiembra: hace(90),
    fechaCosecha: en(45),
    estado: 'en_curso',
    modo: 'fijo',
    valorModo: 700,
    precioReferencia: 245,
    descuentoPct: 8,
    fondeoDesde: hace(120),
    fondeoHasta: hace(90),
    tokensVendidos: 700, // fondeada 100%
    seguroGranizo: true,
    tenencias: [
      { inversorId: inversorCarlos.id, walletAddress: WALLETS.inversor1, tokens: 400 },
      { inversorId: inversorSofia.id, walletAddress: WALLETS.inversor2, tokens: 300 },
    ],
  });

  // 6. Liquidada BIEN (más alto que precio de referencia)
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000006',
    productorId: productorJuan.id,
    establecimientoId: campoAlamos.id,
    cultivoId: soja.id,
    nombre: 'Los Álamos · Soja 2025/26',
    cicloAgricola: '2025/26',
    hectareas: 380,
    rindeEstimado: 3.5,
    fechaSiembra: hace(280),
    fechaCosecha: hace(60),
    estado: 'liquidada',
    modo: 'fijo',
    valorModo: 400,
    precioReferencia: 295,
    descuentoPct: 8,
    fondeoDesde: hace(320),
    fondeoHasta: hace(290),
    tokensVendidos: 400,
    precioLiquidacion: 335, // salió mejor que la referencia
    fechaLiquidacion: hace(30),
    seguroGranizo: true,
    tenencias: [
      { inversorId: inversorCarlos.id, walletAddress: WALLETS.inversor1, tokens: 250 },
      { inversorId: inversorSofia.id, walletAddress: WALLETS.inversor2, tokens: 150 },
    ],
  });

  // 7. Liquidada MAL (por debajo de lo esperado — importante para mostrar
  //    riesgo real, §14 y §16.3 del hackaton.md).
  await crearCampana({
    id: '00000000-2000-0000-0000-000000000007',
    productorId: productorInversorMaria.id,
    establecimientoId: campoPeral.id,
    cultivoId: maiz.id,
    nombre: 'El Peral · Maíz 2024/25',
    cicloAgricola: '2024/25',
    hectareas: 420,
    rindeEstimado: 8.0,
    fechaSiembra: hace(450),
    fechaCosecha: hace(180),
    estado: 'liquidada',
    modo: 'porcentual',
    valorModo: 30,
    precioReferencia: 205,
    descuentoPct: 10,
    fondeoDesde: hace(490),
    fondeoHasta: hace(460),
    tokensVendidos: 950, // 30% × 420 × 8 = 1008 aprox
    precioLiquidacion: 168, // salió mucho peor
    fechaLiquidacion: hace(150),
    tenencias: [
      { inversorId: inversorCarlos.id, walletAddress: WALLETS.inversor1, tokens: 550 },
      { inversorId: inversorSofia.id, walletAddress: WALLETS.inversor2, tokens: 400 },
    ],
  });

  console.log(`✓ Tokenizadas: 2 acopios · 3 plantas · 6 usuarios con wallet · 4 campos · 7 campañas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
