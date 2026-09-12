// VAL-8. Setup mínimo para llevar el backend a `LEDGER_IMPL=solana`.
//
// Qué hace:
//   1) Verifica que la wallet del provider (fee-payer del backend) tenga SOL.
//   2) Crea el mint USDC de prueba (6 decimales, mint authority = fee-payer).
//   3) Imprime las envs listas para pegar en Railway / backend/.env.
//
// Qué NO hace (a propósito):
//   - No crea wallets demo ni campañas — eso es del seed del backend (VAL-17)
//     y de los flujos reales cuando `POST /tokenizadas/wallet/conectar` corre.
//
// Uso:
//   cd solana/agro_token
//   npx ts-node scripts/seed-mint.ts
//
// El provider sale de Anchor.toml + ANCHOR_WALLET / ANCHOR_PROVIDER_URL.
// Requiere Anchor.toml apuntando a Devnet.

import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider } from '@coral-xyz/anchor';
import { createMint } from '@solana/spl-token';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const MIN_SOL_WARN = 1;
const USDC_DECIMALS = 6;

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const feePayer = (provider.wallet as anchor.Wallet).payer;

  console.log(`RPC:       ${connection.rpcEndpoint}`);
  console.log(`Fee-payer: ${feePayer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(feePayer.publicKey);
  const sol = balance / LAMPORTS_PER_SOL;
  console.log(`Balance:   ${sol.toFixed(4)} SOL`);
  if (sol < MIN_SOL_WARN) {
    console.warn(
      `\n⚠️  Fee-payer con ${sol.toFixed(4)} SOL. Recomendado ≥${MIN_SOL_WARN} SOL.\n` +
        `   Airdrop devnet suele dar 429; probá https://faucet.solana.com con la\n` +
        `   pubkey de arriba. El script sigue igual, pero si falla la creación\n` +
        `   del mint fondealo y volvé a correr.\n`,
    );
  }

  console.log(`\nCreando mint USDC de prueba (${USDC_DECIMALS} decimales)...`);
  const usdcMint = await createMint(
    connection,
    feePayer,
    feePayer.publicKey, // mint authority = fee-payer del backend
    null, // freeze authority
    USDC_DECIMALS,
  );
  console.log(`✅ Mint creado: ${usdcMint.toBase58()}`);

  console.log(`\n── Envs para el backend ──────────────────────────────`);
  console.log(`LEDGER_IMPL=solana`);
  console.log(`SOLANA_RPC_URL=${connection.rpcEndpoint}`);
  console.log(`SOLANA_USDC_MINT=${usdcMint.toBase58()}`);
  console.log(`# SOLANA_PROGRAM_ID: usar el de HARVEST.md`);
  console.log(`# SOLANA_FEE_PAYER_SECRET: contenido de ${process.env.ANCHOR_WALLET ?? '~/.config/solana/id.json'}`);
  console.log(`# WALLET_ENCRYPTION_KEY: generar con \`openssl rand -hex 32\``);
  console.log(`──────────────────────────────────────────────────────\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
