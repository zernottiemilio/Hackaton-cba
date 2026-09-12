-- Campos custodiales para el ledger Solana real.
-- Se llenan solo cuando LEDGER_IMPL=solana; en modo mock quedan null.

ALTER TABLE "usuarios"
  ADD COLUMN "wallet_secret_cifrado" TEXT,
  ADD COLUMN "wallet_fondeada_en" TIMESTAMP(3);
