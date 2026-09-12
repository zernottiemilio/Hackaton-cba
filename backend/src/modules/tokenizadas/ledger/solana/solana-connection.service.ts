import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, SignatureResult } from '@solana/web3.js';

@Injectable()
export class SolanaConnectionService implements OnModuleInit {
  private readonly logger = new Logger(SolanaConnectionService.name);
  private _connection: Connection;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SOLANA_RPC_URL') ?? 'https://api.devnet.solana.com';
    this._connection = new Connection(url, 'confirmed');
    this.logger.log(`Solana RPC: ${url}`);
  }

  get connection(): Connection {
    return this._connection;
  }

  async confirmTx(signature: string, timeoutMs = 30_000): Promise<SignatureResult> {
    const conn = this._connection;
    const latest = await conn.getLatestBlockhash();
    const result = await Promise.race([
      conn.confirmTransaction(
        { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        'confirmed',
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`tx ${signature} no confirmó en ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    if ((result as { value?: SignatureResult }).value?.err) {
      throw new Error(`tx ${signature} falló on-chain: ${JSON.stringify((result as { value: SignatureResult }).value.err)}`);
    }
    return (result as { value: SignatureResult }).value;
  }
}
