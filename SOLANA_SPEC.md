# AgroToken · Programa Solana (Anchor)

Especificación para implementar la parte on-chain de una plataforma donde un productor argentino vende parte de su cosecha futura a inversores de cualquier país, con liquidación en Solana y pagos en stablecoin (USDC).

Este documento es la única fuente de verdad para la sesión que implemente el programa. El front ya existe y se conecta después vía IDL. Alcance acá: **solo el programa Anchor, sus tests y el deploy a devnet**.

---

## 1. El negocio en una página

**Problema.** Un productor de 300 ha en Pergamino necesita capital en octubre para sembrar soja que cosecha en abril. No tiene acceso a crédito global: sin rating, sin banco extranjero que le preste, con cepo cambiario. Hoy se financia con el acopio o exportador de la zona, que es el único comprador y fija el descuento.

**Solución.** El productor publica una **campaña**: "vendo 300 toneladas de mi cosecha 2025/26 a 250 USDC cada una, liquido el 30/04/2026 con el acopio Don Pedro". Inversores compran toneladas con USDC y reciben un token por tonelada. El productor cobra en octubre. En abril el acopio recibe el grano y paga las toneladas tokenizadas **al programa**, al precio pizarra del día. Cada holder quema sus tokens y cobra su parte.

**Qué vende la plataforma.** No vende soja. Vende acceso al crédito agro argentino, fraccionado y con liquidación programática. La ganancia del inversor es el descuento (riesgo de crédito) más la variación de precio.

**Roles.**

| Rol | Quién es | Qué firma |
| --- | --- | --- |
| Productor | Dueño del campo. Emisor de la campaña | `create_campaign`, `release_funds` |
| Inversor | Cualquier wallet con USDC | `invest`, `redeem`, `refund` |
| Acopio | Comprador físico del grano, aliado de la plataforma. Único que puede liquidar | `accept_campaign`, `settle` |
| Plataforma | Nosotros. Desplegamos el programa una vez, operamos front y keeper | Nada con privilegios sobre fondos |

**Regla de oro.** La plata de los inversores nunca pasa por el productor a la vuelta. Entra al vault, sale al productor, y a la vuelta la deposita el acopio directo en el vault. El productor no puede tocar el vault salvo `release_funds`, y solo si se alcanzó el mínimo.

**Antecedentes reales para tener presentes.** Agrotoken tokeniza grano ya cosechado (1 SOYA = 1 tn en acopio). Brasil tiene la CPR (Cédula de Produto Rural) desde 1994 y hoy la tokeniza a escala. Los pools de siembra argentinos de los 2000 eran este mismo modelo de participación y muchos quebraron con la sequía 2008/09: por eso se tokeniza una fracción conservadora del rinde.

---

## 2. Glosario web3 mínimo (leer antes de codear)

- **Programa**: el smart contract. Se despliega UNA vez y sirve a todas las campañas de todos los productores. No se crea código por cliente.
- **Cuenta (account)**: en Solana todo estado vive en cuentas. Una cuenta tiene dueño (un programa), datos y saldo en lamports. Nuestro programa es dueño de las cuentas `Campaign`.
- **PDA (Program Derived Address)**: dirección derivada del program id más unas *seeds*. No tiene clave privada. Solo el programa puede firmar "en nombre" de una PDA, desde dentro de una instrucción, usando las seeds. Es el mecanismo que hace que el vault no lo controle ningún humano.
- **Mint**: el "molde" de un tipo de token. Guarda decimales, supply y quién puede acuñar (`mint_authority`). Creamos un mint por campaña. Su `mint_authority` es la PDA de la campaña, así solo el programa acuña, y solo contra USDC recibido.
- **Token account**: cuenta que guarda saldo de UN mint para UN dueño. Tu wallet no "tiene USDC", tiene una token account de USDC. El **vault** es una token account de USDC cuyo dueño es la PDA de la campaña.
- **ATA (Associated Token Account)**: token account con dirección determinística derivada de (wallet, mint). Es la convención estándar. Los inversores reciben tokens de campaña en su ATA.
- **CPI (Cross-Program Invocation)**: nuestro programa llama al SPL Token Program para transferir, acuñar y quemar. Cuando la cuenta origen es del vault, firmamos con las seeds de la PDA (`signer_seeds`).
- **Rent**: cada cuenta necesita un depósito mínimo de SOL para existir. Lo paga quien crea la cuenta (`payer`). Se recupera al cerrar la cuenta.
- **Clock**: `Clock::get()?.unix_timestamp` da la hora on-chain. Es la única forma de validar fechas. No hay cron: nada se ejecuta solo, siempre alguien manda una transacción.
- **IDL**: el JSON que Anchor genera describiendo cuentas e instrucciones. Es lo que el front consume para armar transacciones.

Decisión: usar **SPL Token clásico** (no Token-2022). Menos superficie, más ejemplos, el front ya lo soporta.

---

## 3. Modelo on-chain

### 3.1 Cuentas

```
Campaign (PDA)      seeds = ["campaign", producer, campaign_id_le_bytes]
├── mint (PDA)      seeds = ["mint", campaign]         authority = campaign PDA, decimals = 0
└── vault (ATA)     owner = campaign PDA, mint = USDC
```

Un `campaign_id: u64` por productor permite que un mismo productor tenga varias campañas. El front lo elige (contador o timestamp).

```rust
#[account]
pub struct Campaign {
    pub producer: Pubkey,          // firmante de create_campaign y release_funds
    pub acopio: Pubkey,            // único firmante válido de settle
    pub campaign_id: u64,
    pub crop: [u8; 16],            // "soja", padded
    pub season: [u8; 8],           // "2025/26"
    pub tons_offered: u64,         // cupo máximo de tokens
    pub min_tons: u64,             // mínimo para liberar fondos
    pub price_per_ton: u64,        // en micro-USDC (6 decimales). 250 USDC = 250_000_000
    pub tons_sold: u64,            // tokens acuñados
    pub sale_end: i64,             // unix ts. Después de esto no se puede invertir
    pub settlement_date: i64,      // unix ts. Antes de esto no se puede liquidar
    pub status: CampaignStatus,
    pub tons_delivered: u64,       // lo carga el acopio en settle
    pub settlement_price: u64,     // micro-USDC por tn, lo carga el acopio
    pub payout_per_token: u64,     // micro-USDC. Calculado en settle
    pub usdc_mint: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CampaignStatus {
    Draft,     // creada, falta que el acopio acepte (opcional en MVP)
    Open,      // vendiendo tokens
    Funded,    // fondos liberados al productor
    Settled,   // acopio depositó, se puede redimir
    Failed,    // pasó sale_end sin min_tons, se puede pedir refund
}
```

Todos los montos en **micro-USDC** (`u64`, 6 decimales) para no manejar floats. Todas las cuentas usan `checked_mul` / `checked_add`, nunca aritmética directa.

### 3.2 Máquina de estados

```
create_campaign ──► Draft ──accept_campaign──► Open ──release_funds──► Funded ──settle──► Settled ──redeem (N veces)
                                                │
                                                └── (sale_end && tons_sold < min_tons) ──► Failed ──refund (N veces)
```

En MVP, `create_campaign` puede dejar la campaña directamente en `Open` y `accept_campaign` se omite.

### 3.3 Invariantes que el programa garantiza

1. Supply del mint de campaña == `tons_sold`, siempre. Solo se acuña en `invest`, solo se quema en `redeem`/`refund`.
2. `tons_sold <= tons_offered`.
3. El vault solo se vacía hacia el productor en `release_funds` (una vez, con `tons_sold >= min_tons`), o hacia holders en `redeem`/`refund`.
4. Solo `campaign.acopio` puede ejecutar `settle`, y solo con `now >= settlement_date`.
5. Cada token cobra exactamente `payout_per_token` en `redeem` o `price_per_ton` en `refund`. El polvo de redondeo queda en el vault.

---

## 4. Instrucciones

Para cada una: quién firma, argumentos, cuentas relevantes, validaciones, efectos.

### 4.1 `create_campaign`

- **Firma**: `producer` (también es `payer`).
- **Args**: `campaign_id: u64, crop, season, tons_offered, min_tons, price_per_ton, sale_end, settlement_date, acopio: Pubkey`.
- **Cuentas**: `campaign` (init, PDA), `token_mint` (init, PDA, decimals 0, authority = campaign), `vault` (init ATA, owner = campaign, mint = usdc_mint), `usdc_mint`, programas (system, token, associated_token, rent).
- **Validaciones**: `tons_offered > 0`, `0 < min_tons <= tons_offered`, `price_per_ton > 0`, `now < sale_end < settlement_date`.
- **Efectos**: escribe `Campaign` con `tons_sold = 0`, status `Open` (MVP) o `Draft`.
- **Errores**: `InvalidParams`, `InvalidDates`.

### 4.2 `accept_campaign` (opcional en MVP)

- **Firma**: `acopio`.
- **Validaciones**: `signer == campaign.acopio`, status `Draft`.
- **Efectos**: status `Open`.

### 4.3 `invest`

- **Firma**: `investor`.
- **Args**: `tons: u64`.
- **Cuentas**: `campaign`, `token_mint`, `vault`, `investor_usdc` (ATA del inversor, mint USDC), `investor_token` (ATA del inversor para `token_mint`, `init_if_needed`), token program.
- **Validaciones**: status `Open`, `now < sale_end`, `tons > 0`, `tons_sold + tons <= tons_offered`.
- **Efectos**:
  1. CPI `transfer` USDC: `investor_usdc → vault`, monto `tons * price_per_ton` (checked).
  2. CPI `mint_to`: `tons` tokens a `investor_token`, firmado con seeds de `campaign`.
  3. `tons_sold += tons`.
- **Errores**: `CampaignNotOpen`, `SaleEnded`, `ExceedsOffer`, `MathOverflow`.

### 4.4 `release_funds`

- **Firma**: `producer`.
- **Cuentas**: `campaign`, `vault`, `producer_usdc` (ATA), token program.
- **Validaciones**: `signer == campaign.producer`, status `Open`, `tons_sold >= min_tons`.
- **Efectos**: CPI `transfer` de TODO el saldo del vault a `producer_usdc`, firmado con seeds. Status `Funded`.
- **Errores**: `Unauthorized`, `CampaignNotOpen`, `MinNotReached`.
- **Nota**: después de `Funded` no se puede invertir más. Simplifica todo lo posterior.

### 4.5 `settle`

- **Firma**: `acopio`.
- **Args**: `tons_delivered: u64, settlement_price: u64` (micro-USDC por tn).
- **Cuentas**: `campaign`, `vault`, `acopio_usdc` (ATA del acopio), token program.
- **Validaciones**: `signer == campaign.acopio`, status `Funded`, `now >= settlement_date`, `0 < tons_delivered <= tons_sold`, `settlement_price > 0`.
- **Efectos**:
  1. `deposit = tons_delivered * settlement_price` (checked).
  2. CPI `transfer` USDC `acopio_usdc → vault`, monto `deposit`.
  3. `payout_per_token = deposit / tons_sold` (división entera).
  4. Guardar `tons_delivered`, `settlement_price`, `payout_per_token`. Status `Settled`.
- **Errores**: `Unauthorized`, `CampaignNotFunded`, `TooEarly`, `InvalidDelivery`.
- **Por qué `tons_delivered` puede ser menor que `tons_sold`**: sequía. El acopio paga lo que recibió, la pérdida se reparte pro rata. Es el modelo de participación, explícito.

### 4.6 `redeem`

- **Firma**: `holder` (cualquier wallet con tokens de la campaña; no tiene que ser el inversor original).
- **Args**: `amount: u64` (tokens a quemar; el front manda el saldo completo).
- **Cuentas**: `campaign`, `token_mint`, `vault`, `holder_token` (ATA de `token_mint`), `holder_usdc` (ATA USDC, `init_if_needed`), token program.
- **Validaciones**: status `Settled`, `amount > 0`, `holder_token.amount >= amount`.
- **Efectos**:
  1. CPI `burn` `amount` tokens de `holder_token`.
  2. CPI `transfer` USDC `vault → holder_usdc`, monto `amount * payout_per_token`, firmado con seeds.
- **Errores**: `CampaignNotSettled`, `InsufficientTokens`.

### 4.7 `refund`

- **Firma**: `holder`.
- **Args**: `amount: u64`.
- **Validaciones**: (status `Open` y `now >= sale_end` y `tons_sold < min_tons`) o status `Failed`. Si es la primera, cambia status a `Failed`.
- **Efectos**: `burn` `amount` tokens, `transfer` `amount * price_per_ton` del vault al holder.
- **Errores**: `RefundNotAvailable`.

### 4.8 Errores (enum único)

```rust
#[error_code]
pub enum AgroError {
    InvalidParams, InvalidDates, CampaignNotOpen, SaleEnded, ExceedsOffer,
    MathOverflow, Unauthorized, MinNotReached, CampaignNotFunded, TooEarly,
    InvalidDelivery, CampaignNotSettled, InsufficientTokens, RefundNotAvailable,
}
```

---

## 5. Recortes para la hackathon

**MVP (lo que tiene que funcionar en la demo, en este orden):**

1. `create_campaign` → status `Open` directo.
2. `invest`.
3. `release_funds`.
4. `settle`.
5. `redeem`.

**Se cuenta, no se codea** (o se agrega si sobra tiempo, en este orden): `refund`, `accept_campaign`, mercado secundario (ya funciona gratis: es una transferencia SPL normal), pools de campañas, oráculo de precio (Pyth o dato de la Bolsa de Comercio de Rosario), seguro.

**Simplificaciones aceptadas en devnet:**

- USDC = un mint propio con 6 decimales que creamos en el script de seed. No depender de faucets ajenos.
- `settlement_date` en la demo puede ser `now + 60s` para poder liquidar en vivo. O agregar un feature flag `demo` que ignore la validación de fecha. Preferible lo primero: no meter código que después hay que sacar.
- El acopio es una wallet que controlamos. El programa no distingue.

**No negociable ni en demo:** tres wallets distintas para productor, inversor y acopio. Si la misma wallet crea y liquida, la demo no muestra nada.

---

## 6. Plan de implementación

Tiempo objetivo: 3,5 horas para una persona con Anchor instalado. Verificar versiones vigentes de Solana CLI y Anchor al momento de instalar; no asumir las de memoria.

1. **Setup (20 min)**. `solana --version`, `anchor --version`, `solana config set --url devnet`, wallet local con SOL de devnet (`solana airdrop`). Si no está instalado, empezar por acá YA.
2. **Scaffold (10 min)**. `anchor init agro_token`. Agregar dependencias `anchor-spl` con features `token` y `associated_token`. Habilitar `init-if-needed` en Anchor.
3. **Estado (20 min)**. `Campaign`, `CampaignStatus`, `AgroError`. Calcular `space` con `InitSpace` o a mano (8 discriminador + campos).
4. **`create_campaign` (30 min)**. Es la más larga por las tres inits. Testear que las PDAs derivan bien y que el mint tiene `authority = campaign`.
5. **`invest` (25 min)**. Primer CPI con `signer_seeds`. Si esto funciona, el resto es copiar el patrón.
6. **`release_funds` (15 min)**.
7. **`settle` (20 min)**.
8. **`redeem` (20 min)**.
9. **Tests (40 min)**. Ver sección 7. Correr con `anchor test` (usa validador local).
10. **Deploy devnet (15 min)**. `anchor build`, `anchor deploy`. Guardar el program id en `Anchor.toml` y en `declare_id!`. Copiar el IDL (`target/idl/agro_token.json`) y los types (`target/types/`) al front.
11. **Script de seed (15 min)**. Crea el mint USDC de prueba, tres wallets (producer, investor, acopio), les da SOL y USDC, y crea una campaña de ejemplo. Deja las claves en `.keys/` (gitignored) para que el front las importe en Phantom.

---

## 7. Tests que deben pasar

Happy path completo, en un solo test o encadenados:

1. Crear campaña: `tons_offered = 300`, `min_tons = 200`, `price = 250 USDC`. Verificar PDAs, mint authority, vault vacío.
2. Inversor A compra 100, inversor B compra 200. Vault = 75.000 USDC. Supply del mint = 300. `tons_sold = 300`.
3. Productor libera. Vault = 0, productor +75.000. Status `Funded`.
4. Avanzar el clock (o usar `settlement_date` cercano). Acopio liquida `tons_delivered = 300, price = 310`. Vault = 93.000. `payout_per_token = 310 USDC`. Status `Settled`.
5. A redime 100 → recibe 31.000, supply = 200. B redime 200 → recibe 62.000, supply = 0, vault = 0.

Negativos (uno por invariante):

- `invest` con `tons` que excede el cupo → `ExceedsOffer`.
- `release_funds` con `tons_sold < min_tons` → `MinNotReached`.
- `release_funds` firmado por otra wallet → `Unauthorized`.
- `settle` firmado por el productor → `Unauthorized`.
- `settle` antes de `settlement_date` → `TooEarly`.
- `settle` con `tons_delivered > tons_sold` → `InvalidDelivery`.
- `redeem` antes de `Settled` → `CampaignNotSettled`.
- `invest` después de `Funded` → `CampaignNotOpen`.

Escenario sequía (vale oro en la demo): `tons_delivered = 250`, `price = 310` → vault 77.500, `payout_per_token = 258,33` USDC. A cobra 25.833. Nadie estafado, riesgo repartido.

---

## 8. Integración con el front (después)

El front necesita:

- Program id, IDL y types generados.
- Derivar PDAs con las mismas seeds: `["campaign", producer, campaign_id]`, `["mint", campaign]`, ATA del vault.
- Para listar campañas: `program.account.campaign.all()`. Para las de un productor: filtro `memcmp` sobre `producer`.
- Wallets de demo importadas en tres perfiles de Phantom (o tres navegadores).
- Un keeper opcional (script Node) que mire campañas `Open` con `tons_sold == tons_offered` y dispare `release_funds`. Es comodidad, no confianza: el programa garantiza el resultado aunque el keeper no exista.

---

## 9. Trampas conocidas

- **Micro-USDC**: 250 USDC son `250_000_000`. Confundir esto rompe todos los números de la demo.
- **Decimals 0 en el mint de campaña**: 1 token = 1 tonelada entera. Si quieren fraccionar, usar decimals 3 (kilos) y ajustar la matemática. Para la demo, 0.
- **`init_if_needed`**: requiere la feature en `Cargo.toml`. Sin ella, el inversor tiene que tener la ATA creada antes.
- **`signer_seeds` con bump**: guardar el bump en `Campaign` y usarlo; no recalcular con `find_program_address` en cada instrucción (gasta cómputo).
- **Vaciar el vault**: leer `vault.amount` en la instrucción, no calcular `tons_sold * price`. Si alguien mandó USDC de más al vault, va al productor, no queda trabado.
- **Clock en tests**: `anchor test` corre un validador local. Para saltar `settlement_date` usar un `settlement_date` de pocos segundos o `bankrun`/`LiteSVM` que permiten mover el clock.
- **Strings en cuentas**: usar arrays de bytes fijos (`[u8; 16]`) y no `String`, para que el `space` sea determinístico.
- **Nunca `f64`**. Toda división es entera, el polvo queda en el vault.

---

## 10. Prompt para la sesión que implementa

> Leé `SOLANA_SPEC.md` completo antes de escribir código. Vamos a implementar el programa Anchor descripto ahí, siguiendo el orden de la sección 6. Alcance: solo MVP (sección 5), tests de la sección 7, deploy a devnet y script de seed. Antes de arrancar, verificá qué versión de Solana CLI y Anchor hay instalada y si difieren mucho de lo que la spec asume, decímelo. Después de cada instrucción implementada, corré el test correspondiente antes de pasar a la siguiente. No agregues features que no estén en el MVP sin preguntar. Explicame cada CPI la primera vez que aparece: quiero entender qué firma quién y por qué.
