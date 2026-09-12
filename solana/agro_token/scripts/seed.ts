// Seed script para devnet: crea mint USDC de prueba, 3 wallets (producer/investor/acopio),
// las fondea con SOL y USDC, y crea una campaña de ejemplo.
// Uso: `npx ts-node scripts/seed.ts` (con Anchor.toml apuntando a devnet)

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { AgroToken } from "../target/types/agro_token";

const CAMPAIGN_SEED = Buffer.from("campaign");
const MINT_SEED = Buffer.from("mint");
const KEYS_DIR = path.resolve(__dirname, "../.keys");

const toU64Le = (n: BN) => n.toArrayLike(Buffer, "le", 8);

const padBytes = (s: string, len: number) => {
  const buf = Buffer.alloc(len);
  buf.write(s);
  return Array.from(buf);
};

const saveKeypair = (name: string, kp: Keypair) => {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(KEYS_DIR, `${name}.json`),
    JSON.stringify(Array.from(kp.secretKey)),
  );
};

// Fondea `pubkey` con `sol` SOL transfiriendo desde el fee-payer.
// Alternativa robusta al airdrop del RPC público (típicamente 429 en devnet).
const fundFromPayer = async (
  conn: anchor.web3.Connection,
  payer: Keypair,
  pubkey: PublicKey,
  sol: number,
) => {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: pubkey,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    }),
  );
  await sendAndConfirmTransaction(conn, tx, [payer]);
};

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AgroToken as Program<AgroToken>;
  const connection = provider.connection;
  const feePayer = (provider.wallet as anchor.Wallet).payer;

  console.log(`Provider wallet: ${provider.wallet.publicKey.toBase58()}`);
  console.log(`Cluster:         ${connection.rpcEndpoint}`);

  // 1) Generar wallets de demo
  const producer = Keypair.generate();
  const investor = Keypair.generate();
  const acopio = Keypair.generate();
  saveKeypair("producer", producer);
  saveKeypair("investor", investor);
  saveKeypair("acopio", acopio);
  console.log(`\nWallets creadas (guardadas en ${KEYS_DIR}):`);
  console.log(`  producer: ${producer.publicKey.toBase58()}`);
  console.log(`  investor: ${investor.publicKey.toBase58()}`);
  console.log(`  acopio:   ${acopio.publicKey.toBase58()}`);

  // 2) Fondeo desde el fee-payer (0.3 SOL c/u alcanza para tx + ATAs).
  console.log(`\nFondeando 0.3 SOL a cada wallet desde ${provider.wallet.publicKey.toBase58()}...`);
  await fundFromPayer(connection, feePayer, producer.publicKey, 0.3);
  await fundFromPayer(connection, feePayer, investor.publicKey, 0.3);
  await fundFromPayer(connection, feePayer, acopio.publicKey, 0.3);

  // 3) Crear mint USDC de prueba (6 decimales, mint authority = fee-payer)
  console.log(`\nCreando mint USDC de prueba (6 decimales)...`);
  const usdcMint = await createMint(
    connection,
    feePayer,
    provider.wallet.publicKey,
    null,
    6,
  );
  console.log(`  usdcMint: ${usdcMint.toBase58()}`);
  saveKeypair("usdc_mint_owner", feePayer); // por si el front necesita mintear más

  // 4) ATAs + fondeo USDC (100k al inversor, 200k al acopio)
  const investorUsdc = await createAssociatedTokenAccount(
    connection,
    feePayer,
    usdcMint,
    investor.publicKey,
  );
  const acopioUsdc = await createAssociatedTokenAccount(
    connection,
    feePayer,
    usdcMint,
    acopio.publicKey,
  );
  const producerUsdc = await createAssociatedTokenAccount(
    connection,
    feePayer,
    usdcMint,
    producer.publicKey,
  );

  await mintTo(connection, feePayer, usdcMint, investorUsdc, provider.wallet.publicKey, 100_000_000_000);
  await mintTo(connection, feePayer, usdcMint, acopioUsdc, provider.wallet.publicKey, 200_000_000_000);
  console.log(`  investor USDC: 100.000`);
  console.log(`  acopio USDC:   200.000`);

  // 5) Crear campaña demo: 300 tn @ 250 USDC, min 200
  const campaignId = new BN(1);
  const [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
    [CAMPAIGN_SEED, producer.publicKey.toBuffer(), toU64Le(campaignId)],
    program.programId,
  );
  const [tokenMintPda] = PublicKey.findProgramAddressSync(
    [MINT_SEED, campaignPda.toBuffer()],
    program.programId,
  );
  const vault = getAssociatedTokenAddressSync(usdcMint, campaignPda, true);

  const now = Math.floor(Date.now() / 1000);
  const saleEnd = new BN(now + 60 * 60 * 24 * 7); // +7 días
  const settlementDate = new BN(now + 60 * 60 * 24 * 30); // +30 días

  console.log(`\nCreando campaña demo (id=1, soja 2025/26, 300 tn @ 250 USDC)...`);
  await program.methods
    .createCampaign(
      campaignId,
      padBytes("soja", 16),
      padBytes("2025/26", 8),
      new BN(300),
      new BN(200),
      new BN(250_000_000),
      saleEnd,
      settlementDate,
      acopio.publicKey,
    )
    .accountsPartial({
      producer: producer.publicKey,
      campaign: campaignPda,
      tokenMint: tokenMintPda,
      usdcMint,
      vault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([producer])
    .rpc();

  console.log(`\n✅ Seed listo.`);
  console.log(`   program:   ${program.programId.toBase58()}`);
  console.log(`   usdcMint:  ${usdcMint.toBase58()}`);
  console.log(`   campaign:  ${campaignPda.toBase58()}  (bump ${campaignBump})`);
  console.log(`   tokenMint: ${tokenMintPda.toBase58()}`);
  console.log(`   vault:     ${vault.toBase58()}`);
  console.log(`\nImportá los keypairs de ${KEYS_DIR}/*.json en Phantom (3 perfiles).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
