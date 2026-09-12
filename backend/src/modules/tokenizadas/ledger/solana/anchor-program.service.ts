import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

import { CustodialWallet } from './anchor-wallet';
import { SolanaConnectionService } from './solana-connection.service';
import type { AgroToken } from '../idl/agro_token';
import idlJson from '../idl/agro_token.json';

const CAMPAIGN_SEED = Buffer.from('campaign');
const MINT_SEED = Buffer.from('mint');

/**
 * Fabrica instancias del Program de Anchor para el programa AgroToken.
 *
 * Cada instrucción puede requerir un firmante distinto (productor para
 * publicar, inversor para invertir, etc.), así que ofrecemos un helper
 * `programAs(kp)` que arma un Program tipado con esa wallet.
 *
 * Los helpers de PDA/ATA garantizan que el backend y el programa usen las
 * mismas seeds — la fuente única es este archivo.
 */
@Injectable()
export class AnchorProgramService implements OnModuleInit {
  private readonly logger = new Logger(AnchorProgramService.name);
  private _programId: PublicKey;

  constructor(
    private readonly config: ConfigService,
    private readonly conn: SolanaConnectionService,
  ) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('SOLANA_PROGRAM_ID');
    if (raw) {
      this._programId = new PublicKey(raw);
    } else {
      this._programId = new PublicKey((idlJson as { address: string }).address);
    }
    this.logger.log(`Anchor programa AgroToken: ${this._programId.toBase58()}`);
  }

  get programId(): PublicKey {
    return this._programId;
  }

  /** Construye un Program firmado por `signer`. Reusar la misma connection. */
  programAs(signer: Keypair): Program<AgroToken> {
    const provider = new AnchorProvider(this.conn.connection, new CustodialWallet(signer), {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    return new Program<AgroToken>(idlJson as unknown as AgroToken, provider);
  }

  /** PDA de la campaña: seeds = ["campaign", producer, campaign_id_le]. */
  campaignPda(producer: PublicKey, campaignIdLe: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [CAMPAIGN_SEED, producer.toBuffer(), campaignIdLe],
      this._programId,
    );
  }

  /** PDA del mint por campaña: seeds = ["mint", campaign]. */
  mintPda(campaign: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([MINT_SEED, campaign.toBuffer()], this._programId);
  }

  /** ATA de una wallet para un mint específico. `allowOwnerOffCurve = true` para PDAs. */
  ata(mint: PublicKey, owner: PublicKey, ownerIsPda = false): PublicKey {
    return getAssociatedTokenAddressSync(mint, owner, ownerIsPda);
  }
}
