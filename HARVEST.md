# Harvest.fi — contexto para la hackathon

Leer esto ANTES de tocar `backend/src/modules/tokenizadas`, `frontend/src/modules/tokenizadas` o `solana/agro_token`. Es el mapa compartido para las tres personas y sus agentes.

## Qué estamos construyendo

Un productor vende parte de su cosecha futura a inversores. Cada tonelada es un token en Solana. El inversor paga en USDC, el productor cobra al cerrar la venta, y en cosecha el acopio paga al contrato al precio del día. Cada holder quema tokens y cobra su parte.

**La demo muestra transacciones reales en Solana devnet. La chain NO se mockea.** Decisión del equipo, 12/09/2026. El reset a "MVP con chain mockeada" (`7ff34ba`) se revirtió en el PR #16.

Docs de fondo: `SOLANA_SPEC.md` (programa on-chain, fuente de verdad), `hackaton.md` (interfaces y front), `CLAUDE.md` (convenciones AgroFácil).

## Arquitectura: custodial

- El usuario se loguea con email. **No hay Phantom ni wallet-adapter.**
- El backend genera un keypair por usuario, lo guarda cifrado en `Usuario.walletSecretCifrado` y firma las transacciones por él.
- El acopio es el fee-payer del backend (`SOLANA_FEE_PAYER_SECRET`). Firma `settle`.
- Feature flag `LEDGER_IMPL=mock|solana` en `backend/src/modules/tokenizadas/tokenizadas.module.ts`. Default `mock`. Con `solana` se usa `ledger/solana-ledger.service.ts`.
- PDAs y cliente Anchor en `ledger/solana/anchor-program.service.ts`. IDL en `ledger/idl/agro_token.json`.

## Roles

| Rol (`rolPlataforma`) | Qué hace | Instrucciones que firma |
|---|---|---|
| `productor` | Crea la campaña, cobra cuando se alcanza el mínimo | `create_campaign`, `release_funds` |
| `inversor` | Compra toneladas, cobra al final | `invest`, `redeem` |
| `admin_plataforma` | Aprueba campañas, liquida en nombre del acopio | `settle` (con el fee-payer) |
| `acopio` | Solo pantallas placeholder por ahora | ninguna |

Guard backend: `@RolPlataforma('productor' | 'inversor' | 'admin_plataforma')`. Guard front: `RutaHarvest roles={[...]}` en `frontend/src/router.tsx`.

## Flujo de la demo (5 pasos, 3 logins)

| # | Quién | Pantalla | Instrucción on-chain | Qué verificar |
|---|---|---|---|---|
| 1 | productor | `/campanas/nueva` → enviar a revisión | ninguna todavía | campaña en `en_revision` |
| 2 | admin | `/revision-emisiones` → aprobar | `create_campaign` | Campaign + mint + vault en explorer |
| 3 | inversor | `/invertir/:id` → comprar 300 tn | `invest` | vault 75.000 USDC, 300 tokens en su ATA |
| 4 | productor | "Cobrar siembra" | `release_funds` | vault 0, productor +75.000 |
| 5 | admin | "Liquidar" 300 tn a 310 | `settle` | vault 93.000, payout 310/token |
| 6 | inversor | `/portfolio` → "Cobrar" | `redeem` | supply 0, inversor +93.000 |

Escenario sequía (vale oro): en el paso 5 liquidar 250 tn a 310. Vault 77.500, payout 258,33 por token. Nadie estafado, riesgo repartido pro rata.

Valores demo: soja 2025/26, 300 tn ofrecidas, mínimo 200, 250 USDC/tn, liquidación `now + 60s` para poder liquidar en vivo.

## Endpoints

Prefijo `/api/v1/tokenizadas`. Existentes:

| Método | Path | Guard |
|---|---|---|
| GET | `marketplace`, `marketplace/:id`, `productores`, `productores/:id`, `cultivos`, `acopios` | público |
| POST | `wallet/conectar` | auth |
| POST | `/`, `:id/enviar-revision` · GET `mis-campanas` | productor |
| POST | `reservas`, `reservas/confirmar`, `reclamar` · GET `portfolio` | inversor |
| GET | `admin/revision` · POST `admin/:id/revisar` | admin_plataforma |

Nuevos, acordados entre back y front (tareas VAL-12 y VAL-18):

| Método | Path | Guard | Body / respuesta |
|---|---|---|---|
| POST | `:id/liberar-fondos` | productor | → `{ txSignature, montoUsd }`. Persiste `txSignatureLiberacion`. Estado → `fondeada` |
| GET | `admin/liquidacion` | admin_plataforma | → `Tokenizacion[]` en estado `fondeada` (pendientes) y `liquidada` (historial), con `campania`, `productor` y `tenencias`. Es lo que lista la pantalla `/liquidacion` |
| POST | `:id/liquidar` | admin_plataforma | `{ toneladasEntregadas, precioLiquidacionUsdTn }` → `{ txSignature, payoutPorTokenUsd, depositoUsd }`. Persiste `toneladasEntregadas`, `precioLiquidacionUsdTn`, `payoutPorTokenUsd`, `txSignatureLiquidacion`. Estado → `liquidada` |
| GET | `:id/on-chain` | público | `{ onChain, status, tonsOffered, tonsSold, minTons, pricePerTonUsd, settlementDate, tonsDelivered, settlementPriceUsd, payoutPerTokenUsd, vaultBalanceUsd, addresses: { campaign, tokenMint, vault, producer, acopio }, explorer: { campaign, tokenMint, vault } }` |

`reclamar` hace solo `redeem` y exige estado on-chain `Settled` (VAL-12). El auto-disparo de `release_funds` y `settle` que vivía en `ensureCampaignSettled()` se eliminó: son pasos propios que firman el productor y el acopio de forma visible. En la demo, el "acopio" es el fee-payer y, como es la mint authority del USDC de prueba, se acuña el depósito antes de `settle`.

## Comisiones de la plataforma

Tasa única `COMISION_PLATAFORMA_PCT = 1.5` en `backend/src/modules/tokenizadas/comisiones.ts`. Se cobra en dos momentos:

| Momento | Quién paga | Cómo |
|---|---|---|
| Compra del inversor (`confirmarCompra`) | inversor, además del precio | transferencia SPL de USDC de su wallet custodial a la tesorería |
| Cobro de la siembra (`liberarFondos`) | productor, sobre lo que salió del vault | transferencia SPL de su wallet custodial a la tesorería |

Cada cobro deja un asiento en `comisiones_plataforma` con bruto, %, comisión, neto, `txReferencia` (la operación) y `txComision` (la transferencia a tesorería). Si la transferencia falla, la operación principal no se revierte: queda `txComision = null` para reprocesar. **La comisión no pasa por el programa Anchor**: es una transferencia SPL común, verificable en el explorer. Meterla en `release_funds` es roadmap.

Endpoints: `GET tokenizadas/comisiones/config` (público: `{ porcentaje, tesoreria }`) y `GET tokenizadas/admin/comisiones` (auditoría con KPIs). Pantalla `/comisiones` (admin). El front muestra el desglose antes de operar en el wizard, en "Cobrar siembra" y en el sheet de compra.

Env: `SOLANA_TESORERIA_ADDRESS` (pubkey, sin secret). Si falta, la tesorería es el fee-payer y el backend avisa con warning; para la demo conviene una wallet aparte para que la comisión se vea como movimiento.

## Envs del backend

```
LEDGER_IMPL=solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=H7Y5ZX4VUF9icFXjuqKmhfCsXBa8wd41Hghvy1e7yvYD
SOLANA_USDC_MINT=
SOLANA_FEE_PAYER_SECRET=      # array JSON o base58. NUNCA commitear.
WALLET_ENCRYPTION_KEY=        # 32 bytes hex
SOLANA_USER_FUND_LAMPORTS=20000000
SOLANA_USER_TEST_USDC=100000000000   # 100.000 USDC de prueba por usuario (la demo compra 75.000)
SOLANA_TESORERIA_ADDRESS=            # pubkey de la wallet que recibe comisiones (sin secret)
```

Los valores los genera el frente Chain (VAL-8) y se pasan por canal privado. Mientras devnet no esté, trabajar con `LEDGER_IMPL=mock`.

**Program devnet (VAL-10)**. Deployado en `H7Y5ZX4VUF9icFXjuqKmhfCsXBa8wd41Hghvy1e7yvYD`. Upgrade authority = wallet local `~/.config/solana/id.json` (`2nzbnwU1uSB3tX4dJ2v818zXuMf33LwSeNJ2bAmXwt47`). `declare_id!` en `lib.rs`, `[programs.*]` en `Anchor.toml` e IDL/types del backend alineados. Upgrade con el binario nuevo hecho (slot 497162547) — cualquier upgrade futuro: `anchor build` + `solana program deploy --program-id H7Y5... --url devnet target/deploy/agro_token.so`.

**VAL-13 (flujo end-to-end contra devnet real)**. Las 5 instrucciones on-chain pasaron desde la API en producción (12/09/2026, campaña `7e55a156-b68e-421b-8e48-33bdb883fea5`):

| Instrucción | Tx signature |
|---|---|
| `create_campaign` | [3cqHSSCsBPQp7WmqopaPCHABVp1UA2aDAriZKJjmMqWS2gzPU8fuTfgtTjM2mJ7CjBXb1ybBCRp2m7eLibsiAHVr](https://explorer.solana.com/tx/3cqHSSCsBPQp7WmqopaPCHABVp1UA2aDAriZKJjmMqWS2gzPU8fuTfgtTjM2mJ7CjBXb1ybBCRp2m7eLibsiAHVr?cluster=devnet) |
| `invest` (5 tn @ 250) | [2u5yDJa9TfYeWEHYKEEhPe3xNaGQho4FVuHYb8ixVEFTVfk6Zoi3yRCkeSbXaWdxaZZzNqHKxCexmxr8BgFe4oFM](https://explorer.solana.com/tx/2u5yDJa9TfYeWEHYKEEhPe3xNaGQho4FVuHYb8ixVEFTVfk6Zoi3yRCkeSbXaWdxaZZzNqHKxCexmxr8BgFe4oFM?cluster=devnet) |
| `release_funds` | [41KjBNotwyvzKCPRzbPgpmzDFewWRrVokmdMcA5sse5gB2mHtCHq4qhb6hMDsvYDEWeLu7uKavi1z2U72GgQDCxR](https://explorer.solana.com/tx/41KjBNotwyvzKCPRzbPgpmzDFewWRrVokmdMcA5sse5gB2mHtCHq4qhb6hMDsvYDEWeLu7uKavi1z2U72GgQDCxR?cluster=devnet) |
| `settle` (5 tn @ 310) | [BqBCKksxddq6qNckSz1PMr9ctxyhVZcNznHgc9YUaAqswdjmAu2NaakVQJF7D2tzsA1YrqQvsDJ6WanJjRRiK3a](https://explorer.solana.com/tx/BqBCKksxddq6qNckSz1PMr9ctxyhVZcNznHgc9YUaAqswdjmAu2NaakVQJF7D2tzsA1YrqQvsDJ6WanJjRRiK3a?cluster=devnet) |
| `redeem` | [4XT26DnWgct7cxgbVnx84KvUpBBRnZFWm9HSxZzfXvjhfC4xhtjKA4LWp28Ua1PTtsAruxeykhdiLsvcScUMCJVs](https://explorer.solana.com/tx/4XT26DnWgct7cxgbVnx84KvUpBBRnZFWm9HSxZzfXvjhfC4xhtjKA4LWp28Ua1PTtsAruxeykhdiLsvcScUMCJVs?cluster=devnet) |

Cifras: Carlos invirtió 1.250 USDC, liquidación a 310/tn depositó 1.550 al vault, redeem le devolvió 1.550 (retorno +25%). Comisión plataforma 1.5% (VAL-40) cobró 18,75 USDC en `invest` y otros 18,75 en `release_funds`.

## Trampas conocidas

- **Micro-USDC.** 250 USDC = `250_000_000`. Token de campaña con decimals 0: 1 token = 1 tonelada entera. Nunca `f64`; división entera, el polvo queda en el vault.
- **Fechas on-chain: `now < sale_end < settlement_date`.** `fondeoHasta` es `sale_end` (se guarda con hora desde la migración `fondeo_con_hora`); `fechaLiquidacionEstimada` es `settlement_date` (si falta, `fondeoHasta + 90 días`). El programa rechaza `create_campaign` si el cierre ya pasó o la liquidación no es posterior, `invest` después de `sale_end`, y `settle` antes de `settlement_date`. `toneladasMinimas` es `min_tons`: sin ese piso vendido no hay `release_funds`. **Para la demo:** el wizard tiene el botón "Demo en vivo (5 + 1 min)": fondeo cierra en 5 minutos, liquidación al sexto. Aprobar, invertir y cobrar la siembra tienen que pasar dentro de esos 5 minutos.
- **Renames de columnas rompen el seed.** `prisma/seed.ts` corre en cada arranque de Railway y ts-node lo compila al vuelo: un campo que ya no existe en el schema tira el backend abajo antes de levantar (pasó con `fechaLiquidacion` → `liquidadaEn`). Cualquier cambio en `TokenizacionCampana` tiene que tocar el seed. Verificar sin DB: `npx prisma generate && npx tsc --noEmit --esModuleInterop --skipLibCheck --target es2020 --module commonjs prisma/seed.ts`.
- **Seed con `LEDGER_IMPL=solana`.** No crea campañas `abierta`/`fondeada`/`liquidada` (tendrían mint y vault inventados que rompen `invest`, `reclamar` y `on-chain`), desactiva las que quedaron de corridas en mock, y NUNCA borra tenencias (son compras reales). La campaña de la demo se crea en vivo. Usuarios demo: `juan@productor.demo`, `carlos@inversor.demo`, `admin@tokenizadas.demo`, password `agrofacil123`.
- **Reserva devuelve `reservaId`, no `id`.** El JSON de `POST /tokenizadas/reservas` es `{ reservaId, expiraEn, precioUsdSnapshot }`. `POST /tokenizadas/reservas/confirmar` espera `{ reservaId }`, no `{ id }`. Encontrado en VAL-13.
- **`reclamar` ya no encadena release_funds ni settle.** Post-VAL-12 solo hace `redeem`. Si la campaña sigue `open` devuelve 400 "La campaña todavía no liquidó". El flujo real es: productor `POST /:id/liberar-fondos` (dispara `release_funds`) → admin `POST /:id/liquidar` (dispara `settle`) → inversor `POST /reclamar` (dispara `redeem`). Actualizar HARVEST cualquier PR que vuelva a mezclar.
- **Railway.** `SUPERADMIN_PASSWORD` en env reescribe el password en cada deploy.
- **Tests de backend.** `tsc -p tsconfig.json` falla en 3 archivos de test preexistentes (`calculos.service.spec.ts`, `test/app.e2e-spec.ts`). Verificar con `tsc -p tsconfig.build.json`, que es lo que buildea Railway.

## Reparto y tareas (Linear, equipo "Valentino Lopez")

| Frente | Épica | Quién | Tareas |
|---|---|---|---|
| Chain | VAL-6 | Emilio | VAL-10 deploy devnet, VAL-8 seed + envs, VAL-14 Railway |
| Backend | VAL-5 | Emilio | VAL-13 flujo real, VAL-11 settlementDate/minTons, VAL-12 endpoints, VAL-18 on-chain, VAL-17 seed usuarios |
| Front | VAL-7 | Valentino | VAL-15 wallet real, VAL-16 Cobrar siembra, VAL-22 Liquidar |
| Front | VAL-7 | Tute | VAL-21 panel on-chain, VAL-19 Cobrar inversor, VAL-20 DEMO.md + ensayo |

Orden: VAL-10 y VAL-8 bloquean la prueba real de todo. Mientras tanto el front avanza con `LEDGER_IMPL=mock` y objetos hardcodeados con la forma de los contratos de arriba.

## Cómo pedirle un ticket a un agente

```
Leé HARVEST.md y CLAUDE.md. Hacé este ticket: [pegar texto del ticket de Linear].
Rama nueva desde origin/main. Antes de dar por terminado, corré el typecheck
del módulo que tocaste y abrí el PR.
```

## Setup local

```bash
cd backend && npm ci && npx prisma generate && npm run start:dev
cd frontend && npm ci && npm run dev
```

Typecheck: `npx tsc -p backend/tsconfig.build.json --noEmit` y `npx tsc -b --noEmit` en frontend.
