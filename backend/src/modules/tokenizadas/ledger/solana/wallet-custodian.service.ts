import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';

import { PrismaService } from '../../../../prisma/prisma.service';
import { cifrar, descifrar } from './crypto.util';
import { SolanaConnectionService } from './solana-connection.service';

/**
 * Custodia de claves privadas.
 *
 * Al conectar wallet por primera vez, genera un keypair fresco, lo cifra con
 * AES-256-GCM, lo persiste, y lo fondea con SOL (para pagar rents y fees) y
 * USDC de prueba (para poder invertir). Todo el fondeo lo paga el fee-payer
 * de la plataforma.
 *
 * El secret cifrado nunca sale del backend. El frontend solo ve la wallet
 * pública (walletAddress) y balances.
 */
@Injectable()
export class WalletCustodianService implements OnModuleInit {
  private readonly logger = new Logger(WalletCustodianService.name);
  private _feePayer: Keypair;
  private _usdcMint: PublicKey;
  private _encryptionKey: string;
  private _fundLamports: number;
  private _testUsdc: bigint;

  constructor(
    private readonly config: ConfigService,
    private readonly conn: SolanaConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    // Init 100% síncrono. Cualquier IO (getBalance a devnet) queda diferido
    // para no bloquear el bootstrap ni caer si el RPC de Solana está lento
    // o inalcanzable desde el container de Railway.
    const impl = this.config.get<string>('LEDGER_IMPL') ?? 'mock';
    if (impl !== 'solana') {
      this.logger.log(`LEDGER_IMPL=${impl} — WalletCustodianService inactivo`);
      return;
    }

    const feePayerSecret = this.config.get<string>('SOLANA_FEE_PAYER_SECRET');
    const usdcMint = this.config.get<string>('SOLANA_USDC_MINT');
    const encKey = this.config.get<string>('WALLET_ENCRYPTION_KEY');
    if (!feePayerSecret || !usdcMint || !encKey) {
      this.logger.error(
        `LEDGER_IMPL=solana pero faltan envs. SOLANA_FEE_PAYER_SECRET=${!!feePayerSecret} SOLANA_USDC_MINT=${!!usdcMint} WALLET_ENCRYPTION_KEY=${!!encKey}. El servicio queda inactivo — chequeá que estén seteadas en Railway.`,
      );
      return;
    }

    try {
      this._feePayer = this.loadFeePayer(feePayerSecret);
      this._usdcMint = new PublicKey(usdcMint);
      this._encryptionKey = encKey;
      this._fundLamports = Number(this.config.get<string>('SOLANA_USER_FUND_LAMPORTS') ?? '20000000');
      this._testUsdc = BigInt(this.config.get<string>('SOLANA_USER_TEST_USDC') ?? '10000000000');
      this.logger.log(
        `WalletCustodianService listo. Fee-payer: ${this._feePayer.publicKey.toBase58()}`,
      );
    } catch (err) {
      this.logger.error(`Init falló: ${(err as Error).message}. El servicio queda inactivo.`);
      return;
    }

    // Balance check en background (no bloquea el arranque).
    setImmediate(() => this.logFeePayerBalance());
  }

  private async logFeePayerBalance(): Promise<void> {
    if (!this._feePayer) return;
    try {
      const balance = await this.conn.connection.getBalance(this._feePayer.publicKey);
      this.logger.log(
        `Fee-payer balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
      );
      if (balance < 0.1 * LAMPORTS_PER_SOL) {
        this.logger.warn(
          `Fee-payer con menos de 0.1 SOL — refondealo con "solana airdrop 5 ${this._feePayer.publicKey.toBase58()}".`,
        );
      }
    } catch (err) {
      this.logger.warn(`No pude leer balance del fee-payer: ${(err as Error).message}`);
    }
  }

  private loadFeePayer(secretRaw: string): Keypair {
    const secret = secretRaw.trim();
    // Soporta dos formatos: JSON array (64 bytes) o base58.
    if (secret.startsWith('[')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret) as number[]));
    }
    return Keypair.fromSecretKey(bs58.decode(secret));
  }

  get feePayer(): Keypair {
    return this._feePayer;
  }

  get usdcMint(): PublicKey {
    return this._usdcMint;
  }

  /**
   * Genera o recupera el keypair custodial del usuario.
   *
   * Si el usuario ya tiene walletSecretCifrado, lo descifra y devuelve.
   * Si no, genera uno nuevo, lo cifra, lo persiste. NO fondea acá — eso lo
   * hace `ensureFunded` para que el flow sea idempotente.
   */
  async getOrCreateKeypair(usuarioId: string): Promise<Keypair> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { id: true, walletSecretCifrado: true, walletAddress: true },
    });

    if (usuario.walletSecretCifrado) {
      const secret = descifrar(usuario.walletSecretCifrado, this._encryptionKey);
      return Keypair.fromSecretKey(Uint8Array.from(secret));
    }

    const nuevo = Keypair.generate();
    const secretCifrado = cifrar(Buffer.from(nuevo.secretKey), this._encryptionKey);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        walletAddress: nuevo.publicKey.toBase58(),
        walletSecretCifrado: secretCifrado,
      },
    });
    this.logger.log(`Nueva wallet custodial para usuario ${usuarioId}: ${nuevo.publicKey.toBase58()}`);
    return nuevo;
  }

  /**
   * Fondea la wallet una sola vez: transfer SOL del fee-payer + crea ATA de
   * USDC + mintea USDC de prueba. Marca `walletFondeadaEn`.
   */
  async ensureFunded(usuarioId: string, kp: Keypair): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { walletFondeadaEn: true },
    });
    if (usuario.walletFondeadaEn) return;

    const conn = this.conn.connection;
    const feePayer = this._feePayer;

    // 1) Transfer SOL fee-payer → user
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: kp.publicKey,
        lamports: this._fundLamports,
      }),
    );
    await sendAndConfirmTransaction(conn, tx, [feePayer]);

    // 2) ATA de USDC + mintTo (mint authority = fee-payer)
    const userUsdcAta = getAssociatedTokenAddressSync(this._usdcMint, kp.publicKey);
    const info = await conn.getAccountInfo(userUsdcAta);
    const ixs = [];
    if (!info) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          userUsdcAta,
          kp.publicKey,
          this._usdcMint,
        ),
      );
    }
    ixs.push(
      createMintToInstruction(this._usdcMint, userUsdcAta, feePayer.publicKey, this._testUsdc),
    );
    const tx2 = new Transaction().add(...ixs);
    await sendAndConfirmTransaction(conn, tx2, [feePayer]);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { walletFondeadaEn: new Date() },
    });
    this.logger.log(
      `Wallet ${kp.publicKey.toBase58()} fondeada: ${this._fundLamports / LAMPORTS_PER_SOL} SOL + ${Number(this._testUsdc) / 1_000_000} USDC`,
    );
  }

  /**
   * Garantiza que `owner` tenga al menos `microUsdc` de USDC de prueba en su
   * ATA, creándola y minteando la diferencia si hace falta. El fee-payer es la
   * mint authority del USDC de devnet. Se usa para que el acopio (fee-payer)
   * pueda pagar el settle en la demo.
   */
  async ensureUsdcBalance(owner: PublicKey, microUsdc: bigint): Promise<PublicKey> {
    const conn = this.conn.connection;
    const feePayer = this._feePayer;
    const ata = getAssociatedTokenAddressSync(this._usdcMint, owner);
    const info = await conn.getAccountInfo(ata);
    const ixs = [];
    let actual = 0n;
    if (!info) {
      ixs.push(createAssociatedTokenAccountInstruction(feePayer.publicKey, ata, owner, this._usdcMint));
    } else {
      const bal = await conn.getTokenAccountBalance(ata);
      actual = BigInt(bal.value.amount);
    }
    if (actual < microUsdc) {
      ixs.push(createMintToInstruction(this._usdcMint, ata, feePayer.publicKey, microUsdc - actual));
    }
    if (ixs.length > 0) {
      await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [feePayer]);
      this.logger.log(
        `USDC de prueba asegurado para ${owner.toBase58()}: ${Number(microUsdc) / 1_000_000} USDC`,
      );
    }
    return ata;
  }

  async getBalances(pubkey: PublicKey): Promise<{ sol: number; usdc: number }> {
    const conn = this.conn.connection;
    const sol = (await conn.getBalance(pubkey)) / LAMPORTS_PER_SOL;
    const ata = getAssociatedTokenAddressSync(this._usdcMint, pubkey);
    const info = await conn.getAccountInfo(ata);
    if (!info) return { sol, usdc: 0 };
    const bal = await conn.getTokenAccountBalance(ata);
    return { sol, usdc: bal.value.uiAmount ?? 0 };
  }
}
