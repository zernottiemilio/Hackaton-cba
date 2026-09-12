// Seed on-chain para Harvest — corre después del seed base cuando
// LEDGER_IMPL=solana. Idempotente: verifica estado on-chain y en BD antes
// de firmar cualquier tx. Si algo falla (faltan envs, RPC caído, fee-payer
// sin SOL), loguea warning y sale con 0 para no bloquear el start.
//
// Tareas:
//   1) Para los usuarios seed (juan, carlos, admin): reemplazar wallet fake
//      (base58 mockeada) por wallet custodial real, y fondearla con
//      SOL + USDC. Carlos (inversor) siempre queda con >= 75.000 USDC.
//   2) Publicar on-chain la campaña "El Peral · Soja 2026/27" (id fija
//      `00000000-2000-0000-0000-000000000004`) si no está publicada.

import { PrismaClient } from '@prisma/client';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import Decimal from 'decimal.js';

import { cifrar } from '../src/modules/tokenizadas/ledger/solana/crypto.util';
import { CustodialWallet } from '../src/modules/tokenizadas/ledger/solana/anchor-wallet';
import type { AgroToken } from '../src/modules/tokenizadas/ledger/idl/agro_token';
import idlJson from '../src/modules/tokenizadas/ledger/idl/agro_token.json';

const CAMPAIGN_SEED = Buffer.from('campaign');
const MINT_SEED = Buffer.from('mint');

// Umbrales de fondeo para los usuarios seed.
const USER_SOL_LAMPORTS = Number(process.env.SOLANA_USER_FUND_LAMPORTS ?? '20000000');
const BASE_USDC_MICRO = BigInt(process.env.SOLANA_USER_TEST_USDC ?? '10000000000');
// Inversor de la demo necesita comprar 300 tn @ 250 USDC = 75.000 USDC.
const INVERSOR_MIN_USDC_MICRO = 75_000n * 1_000_000n;

const CAMPANA_DEMO_ID = '00000000-2000-0000-0000-000000000004';

const USUARIOS_SEED = {
  productor: 'juan@productor.demo',
  inversor: 'carlos@inversor.demo',
  admin: 'admin@tokenizadas.demo',
};

interface Env {
  connection: Connection;
  feePayer: Keypair;
  usdcMint: PublicKey;
  programId: PublicKey;
  encryptionKey: string;
}

function loadEnv(): Env | null {
  const impl = process.env.LEDGER_IMPL ?? 'mock';
  if (impl !== 'solana') {
    console.log('ℹ  LEDGER_IMPL != solana — salto el seed on-chain.');
    return null;
  }
  const rpc = process.env.SOLANA_RPC_URL;
  const feePayerRaw = process.env.SOLANA_FEE_PAYER_SECRET;
  const usdcMintRaw = process.env.SOLANA_USDC_MINT;
  const programIdRaw = process.env.SOLANA_PROGRAM_ID;
  const encKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!rpc || !feePayerRaw || !usdcMintRaw || !programIdRaw || !encKey) {
    console.warn(
      '⚠  LEDGER_IMPL=solana pero faltan envs (SOLANA_RPC_URL/FEE_PAYER_SECRET/USDC_MINT/PROGRAM_ID/WALLET_ENCRYPTION_KEY). Salto el seed on-chain.',
    );
    return null;
  }
  const feePayer = feePayerRaw.startsWith('[')
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(feePayerRaw) as number[]))
    : Keypair.fromSecretKey(bs58.decode(feePayerRaw));
  return {
    connection: new Connection(rpc, 'confirmed'),
    feePayer,
    usdcMint: new PublicKey(usdcMintRaw),
    programId: new PublicKey(programIdRaw),
    encryptionKey: encKey,
  };
}

async function ensureRealWallet(
  prisma: PrismaClient,
  env: Env,
  email: string,
  minUsdcMicro: bigint,
): Promise<Keypair | null> {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    console.warn(`⚠  Usuario ${email} no existe todavía; salto.`);
    return null;
  }

  // Si tiene walletSecretCifrado, ya se creó via el flujo real. Reusamos.
  let kp: Keypair;
  if (usuario.walletSecretCifrado) {
    // No podemos descifrar el secret desde acá si el WALLET_ENCRYPTION_KEY es
    // distinto al del deploy que lo creó — en ese caso lo rotamos con un
    // keypair nuevo (mismo criterio que si estuviera vacío).
    try {
      const { descifrar } = await import('../src/modules/tokenizadas/ledger/solana/crypto.util');
      const secret = descifrar(usuario.walletSecretCifrado, env.encryptionKey);
      kp = Keypair.fromSecretKey(Uint8Array.from(secret));
    } catch (err) {
      console.warn(
        `⚠  No pude descifrar la wallet existente de ${email}: ${(err as Error).message}. Roto keypair.`,
      );
      kp = Keypair.generate();
    }
  } else {
    kp = Keypair.generate();
  }

  // Persistimos si cambiamos algo.
  if (
    !usuario.walletSecretCifrado ||
    usuario.walletAddress !== kp.publicKey.toBase58()
  ) {
    const secretCifrado = cifrar(Buffer.from(kp.secretKey), env.encryptionKey);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        walletAddress: kp.publicKey.toBase58(),
        walletSecretCifrado: secretCifrado,
        walletFondeadaEn: null, // forzar refund abajo
      },
    });
  }

  // Fondeo SOL — asegurar al menos USER_SOL_LAMPORTS.
  const currentSol = await env.connection.getBalance(kp.publicKey);
  if (currentSol < USER_SOL_LAMPORTS) {
    const delta = USER_SOL_LAMPORTS - currentSol;
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: env.feePayer.publicKey,
        toPubkey: kp.publicKey,
        lamports: delta,
      }),
    );
    await sendAndConfirmTransaction(env.connection, tx, [env.feePayer]);
  }

  // Fondeo USDC — asegurar al menos `minUsdcMicro`.
  const userUsdcAta = getAssociatedTokenAddressSync(env.usdcMint, kp.publicKey);
  let currentUsdc = 0n;
  try {
    const acct = await getAccount(env.connection, userUsdcAta);
    currentUsdc = acct.amount;
  } catch {
    // ATA no existe — la creamos abajo.
  }

  const ixs: TransactionInstruction[] = [];
  if (currentUsdc === 0n) {
    try {
      await getAccount(env.connection, userUsdcAta);
    } catch {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          env.feePayer.publicKey,
          userUsdcAta,
          kp.publicKey,
          env.usdcMint,
        ),
      );
    }
  }
  if (currentUsdc < minUsdcMicro) {
    const delta = minUsdcMicro - currentUsdc;
    ixs.push(
      createMintToInstruction(env.usdcMint, userUsdcAta, env.feePayer.publicKey, delta),
    );
  }
  if (ixs.length > 0) {
    const tx = new Transaction().add(...ixs);
    await sendAndConfirmTransaction(env.connection, tx, [env.feePayer]);
  }

  if (!usuario.walletFondeadaEn) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { walletFondeadaEn: new Date() },
    });
  }

  console.log(
    `✓ ${email}: ${kp.publicKey.toBase58()} (${(await env.connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL} SOL, ≥${Number(minUsdcMicro) / 1_000_000} USDC)`,
  );
  return kp;
}

function campaignIdFromUuid(uuid: string): { id: bigint; le: Buffer } {
  const hex = uuid.replace(/-/g, '').slice(0, 16);
  const id = BigInt(`0x${hex}`);
  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(id);
  return { id, le };
}

function padBytes(s: string, len: number): Uint8Array {
  const buf = Buffer.alloc(len);
  buf.write(s.slice(0, len));
  return new Uint8Array(buf);
}

async function publicarCampanaDemo(
  prisma: PrismaClient,
  env: Env,
  productorKp: Keypair,
): Promise<void> {
  const campania = await prisma.campania.findUnique({ where: { id: CAMPANA_DEMO_ID } });
  if (!campania) {
    console.warn(`⚠  Campaña demo ${CAMPANA_DEMO_ID} no existe — salto la publicación.`);
    return;
  }
  const t = await prisma.tokenizacionCampana.findUnique({
    where: { campaniaId: campania.id },
    include: { productor: true, campania: { include: { cultivo: true } } },
  });
  if (!t) {
    console.warn('⚠  Tokenización demo no existe — salto la publicación.');
    return;
  }
  // Fake data del seed base tiene mint prefijado con "MINT" y vault con "VLT".
  // Solo consideramos publicación real si las addresses son válidas.
  const esFake = t.mintAddress?.startsWith('MINT') || t.vaultAddress?.startsWith('VLT');
  if (!esFake && t.txSignaturePublicacion && t.mintAddress && t.vaultAddress) {
    console.log(`✓ Campaña demo ya publicada on-chain: ${t.txSignaturePublicacion.slice(0, 12)}…`);
    return;
  }
  if (esFake) {
    // Limpiamos los fakes para no confundir logs de la publicación real.
    await prisma.tokenizacionCampana.update({
      where: { id: t.id },
      data: { mintAddress: null, vaultAddress: null, txSignaturePublicacion: null },
    });
  }

  // El productor de la campaña demo tiene que coincidir con el keypair que
  // firmamos. Si en BD figura otro, actualizamos.
  const productorReal = await prisma.usuario.findUnique({
    where: { walletAddress: productorKp.publicKey.toBase58() },
  });
  if (!productorReal) throw new Error('No encontré al productor real en BD');
  if (t.productorId !== productorReal.id) {
    await prisma.tokenizacionCampana.update({
      where: { id: t.id },
      data: { productorId: productorReal.id },
    });
  }

  const { id: campaignIdBig, le: campaignIdLe } = campaignIdFromUuid(t.id);
  const [campaignPda] = PublicKey.findProgramAddressSync(
    [CAMPAIGN_SEED, productorKp.publicKey.toBuffer(), campaignIdLe],
    env.programId,
  );
  const [tokenMintPda] = PublicKey.findProgramAddressSync(
    [MINT_SEED, campaignPda.toBuffer()],
    env.programId,
  );
  const vaultAta = getAssociatedTokenAddressSync(env.usdcMint, campaignPda, true);

  const tonsOffered = new BN(
    new Decimal(t.toneladasOfrecidas.toString()).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
  );
  const minTons = new BN(
    new Decimal(t.toneladasMinimas.toString()).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
  );
  const pricePerTon = new BN(
    new Decimal(t.precioTokenUsd.toString())
      .mul(1_000_000)
      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
      .toString(),
  );
  const saleEnd = new BN(Math.floor(t.fondeoHasta.getTime() / 1000));
  const settlementSecs = t.fechaLiquidacionEstimada
    ? Math.floor(t.fechaLiquidacionEstimada.getTime() / 1000)
    : Math.floor(t.fondeoHasta.getTime() / 1000) + 90 * 24 * 60 * 60;
  const settlementDate = new BN(settlementSecs);
  const crop = padBytes(t.campania?.cultivo?.nombre ?? 'generico', 16);
  const season = padBytes((t.campania?.anio ? String(t.campania.anio) : '2026').slice(0, 8), 8);

  const provider = new AnchorProvider(
    env.connection,
    new CustodialWallet(productorKp),
    { commitment: 'confirmed', preflightCommitment: 'confirmed' },
  );
  const program = new Program<AgroToken>(idlJson as unknown as AgroToken, provider);

  // Doble check: si la Campaign PDA ya existe on-chain (deploy previo, DB
  // fuera de sync), la persistimos sin volver a firmar.
  const info = await env.connection.getAccountInfo(campaignPda);
  if (info) {
    await prisma.tokenizacionCampana.update({
      where: { id: t.id },
      data: {
        mintAddress: tokenMintPda.toBase58(),
        vaultAddress: vaultAta.toBase58(),
      },
    });
    console.log(`✓ Campaña demo ya existía on-chain, sincronicé BD.`);
    return;
  }

  console.log('… publicando campaña demo on-chain…');
  const acopio = env.feePayer.publicKey;
  const txSignature = await program.methods
    .createCampaign(
      new BN(campaignIdBig.toString()),
      Array.from(crop),
      Array.from(season),
      tonsOffered,
      minTons,
      pricePerTon,
      saleEnd,
      settlementDate,
      acopio,
    )
    .accountsPartial({
      producer: productorKp.publicKey,
      campaign: campaignPda,
      tokenMint: tokenMintPda,
      usdcMint: env.usdcMint,
      vault: vaultAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  await prisma.tokenizacionCampana.update({
    where: { id: t.id },
    data: {
      mintAddress: tokenMintPda.toBase58(),
      vaultAddress: vaultAta.toBase58(),
      txSignaturePublicacion: txSignature,
      aprobadaEn: t.aprobadaEn ?? new Date(),
    },
  });
  console.log(`✓ Campaña demo publicada: ${txSignature}`);
}

export async function seedOnChain(prisma: PrismaClient): Promise<void> {
  const env = loadEnv();
  if (!env) return;

  const balance = await env.connection.getBalance(env.feePayer.publicKey);
  console.log(
    `🔗 Seed on-chain: RPC=${env.connection.rpcEndpoint} fee-payer=${env.feePayer.publicKey.toBase58()} (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL)`,
  );
  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.warn(
      `⚠  Fee-payer con <0.05 SOL. El seed on-chain probablemente falle. Fondealo con https://faucet.solana.com.`,
    );
  }

  try {
    const productorKp = await ensureRealWallet(prisma, env, USUARIOS_SEED.productor, BASE_USDC_MICRO);
    await ensureRealWallet(prisma, env, USUARIOS_SEED.inversor, INVERSOR_MIN_USDC_MICRO);
    await ensureRealWallet(prisma, env, USUARIOS_SEED.admin, BASE_USDC_MICRO);

    if (productorKp) {
      await publicarCampanaDemo(prisma, env, productorKp);
    }
  } catch (err) {
    // Nunca tumbar el arranque por un error del seed on-chain.
    console.error(`❌ Seed on-chain falló: ${(err as Error).message}`);
    console.error((err as Error).stack);
  }
}
