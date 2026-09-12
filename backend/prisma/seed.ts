import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seed AgroFacil...');

  // Cuenta demo + usuario demo
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

  // Catálogo de cultivos base
  const cultivos = ['soja', 'trigo', 'maíz', 'girasol', 'sorgo'];
  for (const nombre of cultivos) {
    await prisma.cultivo.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  console.log(`✓ Cuenta demo: ${cuenta.nombre}`);
  console.log(`✓ Usuario demo: ${usuario.email} / agrofacil123`);
  console.log(`✓ Cultivos: ${cultivos.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
