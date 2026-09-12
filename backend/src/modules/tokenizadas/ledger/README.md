# Ledger — mock vs Solana

El módulo tokenizadas tiene dos implementaciones del `LedgerService`:

- **`MockLedgerService`** — default. Todo persistido en Postgres, con delays
  artificiales para simular latencia on-chain. Direcciones y firmas fake
  con formato base58 de Solana.
- **`SolanaLedgerService`** — real. Firma contra el programa Anchor
  desplegado en devnet (`DKnf1N2UvAwEfa6eu32F5hSE1UVCc3iK2mbjP84FRMy5`).
  Custodia claves de usuario cifradas con AES-256-GCM.

## Cómo se elige

Feature flag `LEDGER_IMPL` en env del backend:

```bash
LEDGER_IMPL=mock    # default, no requiere ninguna otra env de Solana
LEDGER_IMPL=solana  # requiere SOLANA_* + WALLET_ENCRYPTION_KEY
```

En Railway: setear `LEDGER_IMPL=solana` + las envs de la sección Solana
del `.env.example`. Si algo rompe, quitar la env y el backend vuelve al
mock sin re-deploy de código.

## Setup para modo Solana

1. **Generar `WALLET_ENCRYPTION_KEY`**:
   ```bash
   openssl rand -hex 32
   ```

2. **Fee-payer del backend**: el keypair del dev (`~/.config/solana/id.json`)
   ya sirve — es el mismo que usaste para deployar el programa y es el mint
   authority del USDC de prueba. Copiar el contenido:
   ```bash
   cat ~/.config/solana/id.json
   ```
   Y pegar como valor de `SOLANA_FEE_PAYER_SECRET` (JSON array de 64 bytes).

3. **Migrar Prisma** (agrega `wallet_secret_cifrado` y `wallet_fondeada_en`):
   ```bash
   npx prisma migrate deploy
   ```

4. **Setear las envs restantes** — ver `.env.example` sección `Solana`.

5. **Reiniciar el backend**. Al primer request de `POST /tokenizadas/wallet/conectar`
   el usuario obtiene un keypair custodial nuevo, fondeado con SOL + USDC de prueba.

## Fondear el fee-payer si se queda sin SOL

```bash
solana airdrop 5 <pubkey-del-feepayer> --url devnet
# Si el faucet CLI está rate-limited, usar https://faucet.solana.com
# o QuickNode https://faucet.quicknode.com/solana/devnet
```

## Métodos implementados

| Método | Estado | CPI usada |
|---|---|---|
| `conectarWallet` | ✅ real | `SystemProgram.transfer` + `mintTo` (USDC de prueba) |
| `publicarCampana` | ✅ real | `create_campaign` firmado por productor |
| `reservarTokens` | ⏳ off-chain (BD) | — reservas siguen viviendo en Postgres con TTL 10 min |
| `confirmarCompra` | ✅ real | `invest` firmado por inversor |
| `reclamar` | ✅ real | `release_funds` (auto, firma productor) + `settle` (auto, firma fee-payer/acopio) + `redeem` firmado por inversor |
| `obtenerDisponibilidad` | ✅ híbrido | `program.account.campaign.fetch` para `tons_sold` + BD para reservas |

## Limitaciones conocidas

- **Acopio placeholder**: en `create_campaign` seteamos `campaign.acopio =
  fee-payer del backend` porque la BD todavía no vincula tokenización con
  acopio. Cuando la tokenización elija un acopio real (via `campania.acopioId`
  o similar), ese pubkey debería viajar acá.
- **`min_tons = 1`**: la BD no tiene el campo. `release_funds` acepta
  cualquier `tons_sold >= 1`. Cuando el wizard del productor exponga un
  "mínimo de fondeo para publicar", pasarlo por acá.
- **Auto-liquidación**: `reclamar` dispara `release_funds` + `settle` en la
  misma llamada si la campaña todavía no está `Settled`. Es un atajo para
  el hackathon; en prod hay que separar (endpoint dedicado del acopio para
  `settle`, keeper que dispare `release_funds`).
- **`campaign_id`** se deriva del uuid de la tokenización truncando a los
  primeros 8 bytes. Colisiones prácticas: probabilidad despreciable.
- **`settlement_date`** = `fondeo_hasta + 90 días`. Si querés liquidar antes,
  ajustar el offset en `publicarCampana`.
