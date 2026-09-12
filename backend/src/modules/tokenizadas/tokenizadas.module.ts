import { Module } from '@nestjs/common';
import { TokenizadasController } from './tokenizadas.controller';
import { TokenizadasService } from './tokenizadas.service';
import { CamposTokenizadasService } from './campos-tokenizadas.service';
import { LedgerService } from './ledger/ledger.interface';
import { MockLedgerService } from './ledger/mock-ledger.service';

/**
 * Módulo Campañas Tokenizadas.
 *
 * Cuando el equipo blockchain termine el programa Solana, se agrega
 * SolanaLedgerService y se cambia la clase concreta del provider — nada
 * de la lógica de negocio ni de la UI se toca.
 */
@Module({
  controllers: [TokenizadasController],
  providers: [
    TokenizadasService,
    CamposTokenizadasService,
    { provide: LedgerService, useClass: MockLedgerService },
  ],
  exports: [TokenizadasService, CamposTokenizadasService],
})
export class TokenizadasModule {}
