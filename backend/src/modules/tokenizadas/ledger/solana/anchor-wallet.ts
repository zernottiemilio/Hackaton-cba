import { Wallet } from '@coral-xyz/anchor';
import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Adapter que implementa `Wallet` de Anchor sobre un `Keypair` custodial.
 * Anchor por default espera una wallet interactiva (Phantom); acá firmamos
 * con la clave privada que tenemos en memoria.
 */
export class CustodialWallet implements Wallet {
  constructor(private readonly kp: Keypair) {}

  get publicKey() {
    return this.kp.publicKey;
  }

  get payer(): Keypair {
    return this.kp;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if ('version' in tx) {
      tx.sign([this.kp]);
    } else {
      (tx as Transaction).partialSign(this.kp);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}
