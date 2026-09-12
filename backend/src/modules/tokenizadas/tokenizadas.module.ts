import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenizadasController } from './tokenizadas.controller';
import { TokenizadasService } from './tokenizadas.service';
import { CamposTokenizadasService } from './campos-tokenizadas.service';
import { ProductoresService } from './productores.service';
import { LedgerService } from './ledger/ledger.interface';
import { MockLedgerService } from './ledger/mock-ledger.service';
import { SolanaLedgerService } from './ledger/solana-ledger.service';
import { SolanaConnectionService } from './ledger/solana/solana-connection.service';
import { AnchorProgramService } from './ledger/solana/anchor-program.service';
import { WalletCustodianService } from './ledger/solana/wallet-custodian.service';

/**
 * Módulo Campañas Tokenizadas.
 *
 * El LedgerService se resuelve por feature flag `LEDGER_IMPL` en runtime:
 * - `mock` (default): MockLedgerService, todo persistido en Postgres con delays.
 * - `solana`: SolanaLedgerService, firma real contra devnet.
 *
 * En Railway se activa la impl real seteando `LEDGER_IMPL=solana` + las envs
 * de Solana (RPC_URL, PROGRAM_ID, USDC_MINT, FEE_PAYER_SECRET, ENCRYPTION_KEY).
 * Si algo rompe, se quita la env y se vuelve al mock sin re-deploy de código.
 */
@Module({
  controllers: [TokenizadasController],
  providers: [
    TokenizadasService,
    CamposTokenizadasService,
    ProductoresService,
    MockLedgerService,
    SolanaConnectionService,
    AnchorProgramService,
    WalletCustodianService,
    SolanaLedgerService,
    {
      provide: LedgerService,
      inject: [
        ConfigService,
        MockLedgerService,
        SolanaLedgerService,
      ],
      useFactory: (
        config: ConfigService,
        mock: MockLedgerService,
        solana: SolanaLedgerService,
      ): LedgerService => {
        const impl = config.get<string>('LEDGER_IMPL') ?? 'mock';
        return impl === 'solana' ? solana : mock;
      },
    },
  ],
  exports: [TokenizadasService, CamposTokenizadasService, ProductoresService],
})
export class TokenizadasModule {}
