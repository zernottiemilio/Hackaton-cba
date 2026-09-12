# Campañas Tokenizadas — Plan de implementación sobre AgroFácil MVP

> Este documento traduce la guía de negocio **"Campañas Tokenizadas · Guía de implementación"** a un plan de código concreto sobre el repo tal como quedó tras el reset a `a7da881`.
> Si este doc contradice la guía, gana la guía; este archivo se actualiza.
> Alcance operativo definido con el usuario: **contratos inteligentes, wallets, firma on-chain, stablecoins, KYC real, rampa fiat y ARCA en vivo quedan afuera**. En su lugar hay mocks internos que replican la semántica.

---

## 0. Filosofía

La regla que ordena todo:

> **Nada de lo agronómico se vuelve a construir.** Los módulos actuales de AgroFácil (`Establecimiento`, `Lote`, `Campania`, `LoteCampania`, `Cultivo`, `Labor`, `InsumoAplicado`, cálculos, clima, lluvias) son el **sustrato** sobre el que se apoya la capa comercial. La capa de tokenización **lee** lo agronómico y **agrega** lo comercial encima.

La capa nueva se apoya en tres pilares que NO existen hoy y hay que construir:

1. **Identidad tipada** (`Usuario.tipo` + enrutado por rol)
2. **Emisión de campaña** (nueva entidad que cuelga de `LoteCampania`)
3. **Ledger mock** (tabla que registra los movimientos que en producción escribiría un contrato Solana, con la misma máquina de estados)

---

## 1. Alcance de este ciclo

| **Dentro** | **Afuera (mockeado o placeholder)** |
|---|---|
| Perfiles y flujos del **propietario** (alta campo, alta campaña, config tokenización, seguimiento) | Contratos inteligentes en Solana / EVM |
| Perfiles y flujos del **inversor** (marketplace, ficha, simulación, compra, portfolio) | Wallets on-chain (Phantom, Metamask) |
| Visualización técnica del lote (clima, suelo, NDVI, histórico precios) | Firma on-chain, transferencia real de USDC |
| **Motor de cotización** del token (cálculo en front + validación en back) | Rampa fiat, procesamiento de pagos reales |
| Estados de campaña y su representación visual | ARCA en vivo (CPE/CTG/LPG) — se mockea detrás de su interfaz |
| Panel del acopio y liquidación (mockeada, sin firma) | Cascada de garantías / SGR — solo informacional |
| Rol `INVERSOR`, `PROPIETARIO`, `ACOPIO`, `ADMIN` | KYC real |

Todo lo del **Bloque 1-bis de la guía ("Wallet como capacidad")** queda mockeado: el usuario ve el bloque "vinculá tu wallet" pero al apretar simulamos vinculación con una dirección generada localmente, y las firmas se resuelven con un modal que espera 1s y devuelve "ok". La UI queda lista para cuando entre firma real.

---

## 2. Mapa: qué hay hoy y para qué sirve

### Backend — `backend/src/modules/`

| Recurso existente | Reúso para tokenización |
|---|---|
| `auth/` (JWT + Passport) | Sumar `tipo` al payload y al `usuario-actual`. `auth.service.ts` devuelve el tipo con el token para que el front enrute. |
| `establecimientos/`, `lotes/` | Fuente de "campos" del propietario. Sin cambios; el marketplace **lee**, no escribe. |
| `campanias/`, `lotes-campania/` | Fuente del "subyacente". Cada `EmisionCampania` referencia un `LoteCampania`. |
| `calculos/calculos.service.ts` + `calculos/conversiones.ts` | **Base del motor de cotización.** Reusar `precioUsdPorQq`, `ingresoUsd`, `computarResultado`. La cotización del token se deriva de `costo_total_ha`, `rinde_esperado_qq_ha` y `precio_grano_usd_tn`. |
| `cultivos/` | Catálogo neutro. Sin cambios. |
| `clima/`, `lluvias/` | Datos técnicos del lote — reusar tal cual en la ficha del inversor. |
| `insumos-aplicados/`, `labores/` | Alimentan el `costo_total` que entra en la fórmula del token. Sin cambios. |
| `asistente/` | Queda solo para el propietario. Se filtra por rol. |

### Frontend — `frontend/src/`

| Recurso existente | Reúso |
|---|---|
| `components/layout/AppLayout.tsx` + `Sidebar.tsx` + `Topbar.tsx` | **Shell verde JD**, que es donde inyectamos. El sidebar se hace **role-aware** (dos menús distintos según `usuario.tipo`, no un menú con items ocultos). |
| `components/layout/RutaProtegida.tsx` | Extender para `RutaPorRol` (guard por tipo de usuario). |
| `components/layout/OfflineIndicator.tsx`, `MobileDrawer.tsx`, `CommandPalette.tsx` | Sin cambios. |
| `constants/navigation.ts` | Dividir en dos arrays: `navItemsPropietario`, `navItemsInversor`, `navItemsAcopio`, `navItemsAdmin`. |
| `pages/CampaniaDetallePage.tsx`, `CampaniasPage.tsx` | El propietario los sigue usando. La página "Nueva emisión" se agrega **al costado** — no reemplaza. |
| `pages/LoteCampaniaDetallePage.tsx` (1059 líneas — el corazón del cálculo) | Fuente para la ficha del inversor: los charts (`CostDonut`, `ThermometerEquilibrium`), el mapa y el histórico se reciclan. |
| `services/calculosService.ts` | Reusar; se le agrega un método `cotizarToken(loteCampaniaId, cantidadTn)`. |
| `services/campaniasService.ts`, `lotesCampaniaService.ts` | Sin cambios; se agrega un `emisionesService.ts` nuevo. |
| `pages/auth/` | Login: agregar redirect por tipo. Registro: agregar las dos tarjetas (Propietario / Inversor). |

### Base de datos — `backend/prisma/schema.prisma`

Modelos actuales (que tocamos o extendemos):

| Modelo | Cambio |
|---|---|
| `Usuario` | **+ `tipo: TipoUsuario`** (enum), **+ `walletAddress: String?`** (única), **+ `nombreVisible: String?`**. |
| `Cuenta` | Sin cambios (sigue siendo el tenant del productor). El inversor arranca con su cuenta 1:1 con el usuario. |
| `LoteCampania` | Sin cambios. Es el subyacente. |
| `Establecimiento`, `Lote`, `Campania`, `Cultivo`, `Labor`, `InsumoAplicado`, `RegistroLluvia`, `Conversacion`, `Mensaje` | Sin cambios. |

Modelos nuevos (Bloque 3+):

- `EmisionCampania` — la parte comercial que se publica de un `LoteCampania`.
- `OrdenInversion` — cada compra de un inversor.
- `Acopio` — dónde se liquida.
- `MovimientoLedger` — el "contrato mockeado": registra cada operación con `tipo`, `hash_simulado`, `fecha_confirmacion`, `estado`.

---

## 3. Modelo de datos — nuevos modelos

Diseño propuesto (a validar con el usuario antes de escribir la migración):

```prisma
enum TipoUsuario {
  propietario
  inversor
  acopio
  admin
}

enum EstadoEmision {
  borrador      // el propietario todavía la está armando
  abierta       // publicada, aceptando ordenes
  fondeada      // se alcanzó el mínimo y el propietario "cobró"
  cancelada     // no se llegó al mínimo antes del cierre
  liquidada     // el acopio informó entrega y precio final
  cerrada       // todos los inversores cobraron
}

model EmisionCampania {
  id                  String   @id @default(uuid())
  cuentaId            String   @map("cuenta_id")               // tenant del propietario
  loteCampaniaId      String   @map("lote_campania_id")        // subyacente agronómico
  acopioId            String   @map("acopio_id")               // dónde se entrega y liquida
  toneladasOfrecidas  Decimal  @map("toneladas_ofrecidas") @db.Decimal(12, 4)
  precioTokenUsdc     Decimal  @map("precio_token_usdc") @db.Decimal(14, 4)  // por tonelada
  toneladasMinimas    Decimal  @map("toneladas_minimas") @db.Decimal(12, 4)
  fechaCierre         DateTime @map("fecha_cierre") @db.Date        // hasta cuándo se puede invertir
  fechaLiquidacion    DateTime @map("fecha_liquidacion") @db.Date   // cuándo se cierra el precio final
  estado              EstadoEmision @default(borrador)
  hashSimulado        String?  @map("hash_simulado")            // simula el program-derived-address
  precioFinalUsdc     Decimal? @map("precio_final_usdc") @db.Decimal(14, 4)  // llenado en liquidación
  toneladasEntregadas Decimal? @map("toneladas_entregadas") @db.Decimal(12, 4)
  activo              Boolean  @default(true)
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  loteCampania        LoteCampania @relation(fields: [loteCampaniaId], references: [id])
  acopio              Acopio       @relation(fields: [acopioId], references: [id])
  ordenes             OrdenInversion[]
  movimientos         MovimientoLedger[]

  @@index([cuentaId, estado])
  @@map("emisiones_campania")
}

model OrdenInversion {
  id                  String   @id @default(uuid())
  emisionId           String   @map("emision_id")
  inversorId          String   @map("inversor_id")             // Usuario.tipo = inversor
  toneladasCompradas  Decimal  @map("toneladas_compradas") @db.Decimal(12, 4)
  usdcInvertido       Decimal  @map("usdc_invertido") @db.Decimal(14, 4)
  cobrado             Boolean  @default(false)
  usdcCobrado         Decimal? @map("usdc_cobrado") @db.Decimal(14, 4)
  createdAt           DateTime @default(now()) @map("created_at")

  emision             EmisionCampania @relation(fields: [emisionId], references: [id])
  inversor            Usuario         @relation("OrdenInversor", fields: [inversorId], references: [id])

  @@index([emisionId])
  @@index([inversorId])
  @@map("ordenes_inversion")
}

model Acopio {
  id           String   @id @default(uuid())
  nombre       String
  cuit         String?  @unique
  localidad    String?
  provincia    String?
  responsableUsuarioId String? @map("responsable_usuario_id")  // Usuario.tipo = acopio
  activo       Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")

  responsable  Usuario? @relation("AcopioResponsable", fields: [responsableUsuarioId], references: [id])
  emisiones    EmisionCampania[]

  @@map("acopios")
}

enum TipoMovimientoLedger {
  emision_creada
  compra
  liberacion_al_productor
  cancelacion_reembolso
  liquidacion_declarada
  cobro_inversor
}

model MovimientoLedger {
  id           String   @id @default(uuid())
  emisionId    String   @map("emision_id")
  tipo         TipoMovimientoLedger
  usuarioId    String   @map("usuario_id")                     // quién disparó
  monto        Decimal? @db.Decimal(14, 4)
  metadata     Json?
  hashSimulado String   @map("hash_simulado")                  // uuid o hash sha256 de payload
  createdAt    DateTime @default(now()) @map("created_at")

  emision      EmisionCampania @relation(fields: [emisionId], references: [id])
  usuario      Usuario         @relation("MovimientoUsuario", fields: [usuarioId], references: [id])

  @@index([emisionId, tipo])
  @@map("movimientos_ledger")
}
```

**Decisiones pendientes antes de correr la migración:**

- **D1** — ¿El inversor tiene `Cuenta` propia (multi-tenant) o entra como usuario suelto? Propuesta: cada inversor tiene su `Cuenta` 1:1 con su `Usuario`. Mantenemos el filtro por `cuenta_id` sin excepciones.
- **D2** — Precio del token: ¿USDC/tn o USD/tn con etiqueta? Propuesta: **USDC/tn**, guardado como `Decimal(14,4)`. Como no hay stablecoin real, USDC ≡ USD.
- **D3** — Cotización del token: ¿siempre la fija el propietario, o el sistema propone un rango sugerido? Propuesta: el back devuelve `precioSugeridoUsdc` (basado en costos + margen razonable) y una banda `[min, max]`; el front lo muestra pre-cargado pero editable.
- **D4** — `fechaLiquidacion` en la demo: 60 segundos vs. fecha real. Para producción es fecha real; para demo, dejar un flag `MODO_DEMO` que acorta timers.
- **D5** — Qué hace el `MovimientoLedger` en modo mock: solo persistir, o también emitir un evento websocket para que el front se actualice en vivo. Propuesta: emitir vía SSE al `emisionId` para que el marketplace refleje fondeo en tiempo real.

---

## 4. Bloques de trabajo

Cada bloque lista **archivos a tocar**, **archivos a crear** y **criterio de verificación**. Respeta el orden.

### Bloque 1 · Identidad y tipo de usuario

**Objetivo:** `Usuario.tipo` decide adónde va cada login. Backend es la fuente de verdad.

**Tocar:**
- `backend/prisma/schema.prisma` — enum `TipoUsuario`, campo `Usuario.tipo` (default `propietario` para migración), `walletAddress` (opcional, único), `nombreVisible`.
- `backend/src/modules/auth/auth.service.ts` — devolver `tipo` y `nombreVisible` en el response del login.
- `backend/src/modules/auth/dto/*` — DTO de registro con campo `tipo` (Zod enum).
- `backend/src/common/types/usuario-actual.ts` — agregar `tipo`.
- `backend/src/modules/auth/jwt.strategy.ts` — incluir `tipo` en el request.
- `frontend/src/stores/authStore.ts` — persistir `tipo` en el estado.
- `frontend/src/services/authService.ts` — tipar respuesta.

**Crear:**
- Migración Prisma `agregar_tipo_usuario_y_wallet`.
- `backend/prisma/seed.ts` — actualizar para crear usuarios de los 4 tipos.
- `frontend/src/pages/auth/RegistroPage.tsx` — pantalla con las dos tarjetas (Propietario / Inversor). Los tipos `acopio` y `admin` se crean solo desde seed/admin, no desde registro público.

**Verificación:**
- Login existente sigue funcionando (todos los usuarios actuales quedan como `propietario`).
- Registro nuevo pide elegir tipo y crea `Usuario.tipo` correcto.
- El JWT lleva `tipo` y `authStore.usuario.tipo` es legible en el front.

### Bloque 2 · Enrutado por rol y sidebar tipada

**Objetivo:** cada tipo ve su propio menú y solo puede entrar a sus rutas.

**Tocar:**
- `frontend/src/components/layout/RutaProtegida.tsx` — extender a `RutaProtegida` (login) + `RutaPorRol` (tipo).
- `frontend/src/components/layout/Sidebar.tsx` — leer `usuario.tipo`, elegir `navItems` correcto.
- `frontend/src/constants/navigation.ts` — split en 4 arrays: `navItemsPropietario` (los actuales), `navItemsInversor` (Inicio inversor, Marketplace, Portfolio, Perfil), `navItemsAcopio` (Panel, Emisiones asignadas), `navItemsAdmin` (Cola de revisión, Usuarios).
- `frontend/src/App.tsx` (o router principal) — envolver rutas por rol.

**Crear:**
- `frontend/src/pages/inicio/InicioInversorPage.tsx` — placeholder por ahora.
- `frontend/src/pages/inicio/InicioAcopioPage.tsx`.
- `frontend/src/pages/inicio/InicioAdminPage.tsx`.

**Verificación:**
- Un inversor logueado que escribe `/campos` en la URL es redirigido a `/marketplace` con un aviso.
- El sidebar muestra items distintos según el tipo.
- Un propietario NO ve "Marketplace" en su sidebar.

### Bloque 3 · Modelos `EmisionCampania`, `OrdenInversion`, `Acopio`, `MovimientoLedger`

**Objetivo:** dejar el esquema y los CRUDs mínimos para las siguientes capas.

**Crear:**
- Migración `agregar_emisiones_ordenes_acopios_ledger`.
- `backend/src/modules/emisiones/` (controller, service, module, dto).
- `backend/src/modules/acopios/` (controller, service, module, dto).
- `backend/src/modules/ordenes/` (controller, service, module, dto).
- `backend/src/modules/ledger/` (service interno + endpoint de lectura por emisión).
- `frontend/src/services/emisionesService.ts`, `acopiosService.ts`, `ordenesService.ts`, `ledgerService.ts`.

**Verificación:**
- Se puede crear una emisión en estado `borrador` desde un endpoint autenticado con `tipo=propietario`.
- Un inversor NO puede llamar al endpoint de crear emisión (guard por tipo).

### Bloque 4 · Motor de cotización

**Objetivo:** el precio del token se calcula en el mismo lugar donde se calcula el resultado del lote — **una sola fórmula, un solo archivo**.

**Tocar:**
- `backend/src/modules/calculos/calculos.service.ts` — agregar método `cotizarEmision(loteCampaniaId, toneladasOfrecidas)`. Reusa `computarResultado`, aplica margen sugerido, devuelve `precioSugerido`, `bandaMin`, `bandaMax`, `costoImplicitoPorTn`.
- `backend/src/modules/calculos/conversiones.ts` — sumar helper `precioTokenSugerido(costoTotalHa, rindeEsperadoQqHa, margenPct)`.
- `frontend/src/services/calculosService.ts` — nuevo endpoint `cotizarEmision`.

**Crear:**
- Test unitario: dado un `LoteCampania` con 240 ha, rinde 42 qq/ha, precio grano 250 USD/tn, costo 800 USD/ha → precio_token entre X y Y.

**Verificación:**
- El endpoint devuelve exactamente lo mismo que la calculadora del front (o el front consume el endpoint — para MVP es más simple así).
- La fórmula está en un único archivo. Si aparece duplicada, refactorizar.

### Bloque 5 · Wizard "Nueva emisión" (propietario)

**Objetivo:** un formulario que reusa `LoteCampania` ya cargados.

**Crear:**
- `frontend/src/pages/emisiones/NuevaEmisionPage.tsx` — 3 pasos:
  1. **Elegir campaña** — dropdown que lista `LoteCampania` del propietario (autocompletado con mapa, superficie, rinde, cultivo, todo en modo lectura).
  2. **Datos comerciales** — toneladas ofrecidas, precio token (con sugerencia del motor), mínimo, fecha cierre, fecha liquidación, acopio.
  3. **Confirmar + firmar (mock)** — modal "firma simulada" que se resuelve en 1s. Al confirmar, `EmisionCampania` pasa de `borrador` a `abierta` y se crea `MovimientoLedger` tipo `emision_creada`.
- `frontend/src/components/emisiones/BloqueDatosAgronomicos.tsx` — muestra el subyacente (mapa, ha, rinde, cultivo, campaña).

**Verificación:**
- Publicar una emisión no requiere reescribir ningún dato agronómico.
- Después de publicar, la emisión aparece en el marketplace en tiempo real (SSE) para todos los inversores conectados.

### Bloque 6 · Marketplace y ficha (inversor)

**Objetivo:** el inversor ve las emisiones abiertas, entra a la ficha, simula.

**Crear:**
- `frontend/src/pages/marketplace/MarketplacePage.tsx` — grid de cards, filtros por cultivo/provincia/monto.
- `frontend/src/pages/marketplace/FichaEmisionPage.tsx` — datos agronómicos del `LoteCampania` (mapa, rinde histórico, clima ↔ reusa `climaService`, `lluviasService`), datos comerciales, barra de fondeo en tiempo real (SSE del ledger), simulador de retorno (mueve precio grano y toneladas, muestra pago por token estimado).
- `frontend/src/components/marketplace/CardEmision.tsx`, `SimuladorRetorno.tsx`, `BarraFondeo.tsx`.

**Reusa:**
- `frontend/src/pages/LoteCampaniaDetallePage.tsx` — extraer sub-componentes de mapa y charts (`CostDonut`, `ThermometerEquilibrium`, `HeatmapLluvias`) a `frontend/src/components/agronomico/` para consumirlos desde la ficha del inversor.

**Verificación:**
- Un inversor logueado ve el marketplace en `/marketplace`.
- La ficha muestra clima y lluvias reales del lote (los servicios ya funcionan).
- La barra de fondeo se actualiza sola cuando otro inversor compra (SSE).

### Bloque 7 · Compra (inversor) y liberación (propietario) — mocks

**Objetivo:** simular las dos operaciones que en producción firmarían on-chain.

**Crear:**
- `POST /emisiones/:id/ordenes` — el inversor compra `N` toneladas. Genera `OrdenInversion` + `MovimientoLedger` tipo `compra`.
- `POST /emisiones/:id/liberar` — el propietario cobra si `toneladasCompradas ≥ toneladasMinimas`. Cambia estado a `fondeada` y crea `MovimientoLedger` tipo `liberacion_al_productor`. Guard: solo el propietario de la emisión.
- `frontend/src/components/wallet/ModalFirmaMock.tsx` — modal reusable con estados esperando/confirmando/listo/error. Interfaz idéntica a lo que sería un `useWallet().signTransaction()` real, para que el reemplazo futuro sea inserción, no rewrite.
- `frontend/src/components/wallet/BloqueVinculacionMock.tsx` — bloque "vinculá tu wallet" que aparece antes del botón de firma. Al confirmar, `Usuario.walletAddress = "mock_<uuid>"`.

**Verificación:**
- Un inversor compra 100 tn de una emisión de 300 tn → `OrdenInversion` creada, barra de fondeo pasa a 33%.
- Cuando otro inversor compra las 200 restantes → propietario ve botón "Cobrar 75.000 USDC" habilitado. Antes del mínimo, botón deshabilitado con motivo.

### Bloque 8 · Portfolio del inversor

**Objetivo:** el inversor ve sus tenencias, con estado en vivo de cada emisión.

**Crear:**
- `frontend/src/pages/portfolio/PortfolioInversorPage.tsx` — tabla con `OrdenInversion` × `EmisionCampania`, columnas: emisión, toneladas, invertido, estado, valor estimado actual (usando `cotizarEmision` con precio spot), botón "Cobrar" cuando `estado=liquidada` y `cobrado=false`.
- `POST /ordenes/:id/cobrar` — mock del cobro. Marca `cobrado=true`, guarda `usdcCobrado`, crea `MovimientoLedger` tipo `cobro_inversor`.

**Verificación:**
- Portfolio suma correctamente los USDC invertidos.
- El botón cobrar solo aparece cuando la emisión está liquidada y la orden no fue cobrada.

### Bloque 9 · Panel del acopio + liquidación (mockeada, sin firma)

**Objetivo:** el acopio declara toneladas entregadas y precio final. La emisión pasa a `liquidada`.

**Crear:**
- `frontend/src/pages/acopio/AcopioPanelPage.tsx` — lista de emisiones donde `acopioId === usuario.acopio.id`.
- `frontend/src/pages/acopio/LiquidarEmisionPage.tsx` — form: toneladas entregadas, precio final USDC/tn. Confirma → `MovimientoLedger` tipo `liquidacion_declarada`, emisión pasa a `liquidada`, se calcula `usdcCobrable` por orden a prorrata.
- `POST /emisiones/:id/liquidar` — solo `tipo=acopio` y `emision.acopioId = usuario.acopio.id`.

**Verificación:**
- Escenario feliz (guía Parte 3, Momento 4): 300 tn × 310 USDC → total_vault 93.000 → pago por token 310.
- Escenario sequía (Parte 3, Momento 4-bis): 250 tn × 310 USDC → total_vault 77.500 → pago por token 258,33. **Esta es la vista que hay que mostrar en la demo.**

### Bloque 10 · Cancelación por no fondeo

**Objetivo:** cerrar el ciclo negativo — si no se llegó al mínimo antes del cierre, los inversores recuperan lo invertido.

**Crear:**
- Job/cron simple que corre 1×/día: si `fechaCierre` pasó y `toneladasCompradas < toneladasMinimas` → estado `cancelada` + `MovimientoLedger` por cada orden tipo `cancelacion_reembolso`.
- Endpoint manual `POST /emisiones/:id/cancelar` para forzar en demo.

**Verificación:**
- Una emisión sin llegar al mínimo pasa a `cancelada`, cada `OrdenInversion` recibe reembolso mock.

---

## 5. Rutas por rol (referencia rápida)

| Ruta | Roles permitidos |
|---|---|
| `/`, `/campos`, `/lotes`, `/campanas`, `/campanas/:id`, `/lotes-campania/:id`, `/carga`, `/insumos`, `/cultivos`, `/resumen`, `/asistente`, `/clima`, `/lluvias` | `propietario`, `admin` |
| `/emisiones/nueva`, `/emisiones/:id`, `/emisiones/mias` | `propietario` |
| `/marketplace`, `/marketplace/:emisionId`, `/portfolio` | `inversor` (marketplace también público para no-logueados en fase 2) |
| `/acopio`, `/acopio/liquidar/:emisionId` | `acopio` |
| `/admin/revision`, `/admin/usuarios` | `admin` |

Los guards se hacen en `RutaPorRol`. Un usuario que entra a una ruta que no le corresponde se redirige a `/` (que a su vez enruta según su tipo).

---

## 6. Máquina de estados de `EmisionCampania`

```
       ┌────────────┐  publicar   ┌──────────┐  llegó al mínimo   ┌──────────┐   liquidar   ┌────────────┐   cobrar todos   ┌──────────┐
       │  borrador  │ ──────────> │ abierta  │ ─────────────────> │ fondeada │ ───────────> │ liquidada  │ ──────────────> │  cerrada │
       └────────────┘             └────┬─────┘                    └──────────┘              └────────────┘                  └──────────┘
                                       │
                                       │ vence sin mínimo
                                       ▼
                                 ┌──────────┐
                                 │cancelada │
                                 └──────────┘
```

**Reglas de la máquina** (a implementar en `emisiones.service.ts`, un solo lugar):

- `borrador → abierta`: solo el propietario dueño; requiere `MovimientoLedger` tipo `emision_creada` exitoso.
- `abierta → fondeada`: solo el propietario dueño; requiere `toneladasCompradas ≥ toneladasMinimas`.
- `abierta → cancelada`: automático si `now() > fechaCierre` y no se llegó al mínimo; también manual desde admin.
- `fondeada → liquidada`: solo el acopio asignado; requiere `toneladasEntregadas` y `precioFinalUsdc`.
- `liquidada → cerrada`: automático cuando todas las órdenes están `cobrado=true`.

**Front:** cada botón se habilita/deshabilita según el estado, y **cuando está deshabilitado dice por qué** (la guía lo marca como regla de oro).

---

## 7. Convenciones para el trabajo

- **Reusar sobre reescribir.** Antes de crear un componente nuevo, buscar si algo existente sirve extendido. `LoteCampaniaDetallePage.tsx` tiene 1059 líneas de charts, mapas y KPIs — no rehacerlos.
- **Una sola fórmula.** El motor de cotización vive en `calculos.service.ts`. Si aparece duplicado, refactorizar antes de commitear.
- **Guards por rol siempre en backend.** Nunca confiar en el `tipo` que llega del front.
- **Mocks con interfaz idéntica a producción.** `ModalFirmaMock` expone `signAndSend(tx): Promise<{ hashSimulado }>`. El día que entre firma real, se cambia la implementación adentro y nada más.
- **Multi-tenant sin excepciones.** El middleware de Prisma sigue filtrando por `cuenta_id`. El inversor tiene su propia cuenta.
- **Unidades canónicas** (del CLAUDE.md): superficie en ha, rinde en qq/ha, precio grano en USD/tn (o USDC/tn, equivalentes en mock), token en USDC/tn.

---

## 8. Verificación end-to-end (demo)

La demo replica la Parte 9 de la guía, adaptada a mock:

1. **Juan publica** (Perfil propietario). Nueva emisión → elige `LoteCampania` "La Escondida — Soja 25/26". Autocompletado. 5 campos comerciales. Firma mock. Emisión pasa a `abierta`.
2. **María compra** (Perfil inversor). Marketplace → ficha → simulador → compra 300 tn. Firma mock. Barra al 100%. `OrdenInversion` creada.
3. **Juan cobra la siembra**. Vuelve al perfil propietario. Botón "Cobrar 75.000 USDC" habilitado. Firma mock. Emisión pasa a `fondeada`.
4. **Acopio liquida** (Perfil acopio). Panel del acopio → declara 300 tn × 310 USDC. Emisión pasa a `liquidada`. Pago por token = 310.
5. **María cobra**. Portfolio → botón cobrar en la orden. Firma mock. `OrdenInversion.cobrado=true`, `usdcCobrado=93.000`.
6. **Escenario sequía (opcional pero vale oro):** segunda emisión, acopio declara 250 tn × 310. Pago por token = 258,33. Mensaje: *"El riesgo se repartió a prorrata, estaba en el contrato desde el día uno."*

---

## 9. Deuda técnica consciente (a mostrar antes de que la pregunten)

- **La firma es mock.** La interfaz está lista para adaptador real de wallet (Phantom/Metamask) — reemplazo aislado a `ModalFirmaMock` y `BloqueVinculacionMock`.
- **El ledger es una tabla Postgres.** Reemplazo a un cliente Anchor + programa Solana en devnet: ver la guía completa Parte 5-7. Las semillas y las direcciones derivadas ya están descritas ahí.
- **El acopio informa toneladas y precio sin verificación externa.** Camino: integración con la CPE de ARCA.
- **`fechaLiquidacion` en modo demo se acelera con flag.** En producción, cron real.
- **Sin KYC.** Cualquiera puede registrarse como inversor. Fase 2.
- **Sin rampa fiat.** USDC ≡ USD por convención de mock.

---

## 10. Orden ejecutable (checklist)

Marcá a medida que avanzás. **No saltear el orden — cada bloque depende del anterior.**

- [ ] **Bloque 1** — `Usuario.tipo`, migración, seed, DTO registro, login devolviendo tipo
- [ ] **Bloque 2** — `RutaPorRol`, sidebar tipada, `navigation.ts` split
- [ ] **Bloque 3** — modelos `EmisionCampania`, `OrdenInversion`, `Acopio`, `MovimientoLedger` + módulos backend + services front
- [ ] **Bloque 4** — motor de cotización en `calculos.service.ts` + endpoint + test
- [ ] **Bloque 5** — wizard "Nueva emisión"
- [ ] **Bloque 6** — Marketplace + Ficha (reusa charts/mapa de `LoteCampaniaDetallePage`)
- [ ] **Bloque 7** — Compra + liberación (mocks) + `ModalFirmaMock` + `BloqueVinculacionMock`
- [ ] **Bloque 8** — Portfolio inversor
- [ ] **Bloque 9** — Panel acopio + liquidación
- [ ] **Bloque 10** — Cancelación por no fondeo

**Métrica que importa:** un usuario nuevo puede completar el flujo demo (los 5 pasos de la Parte 8) sin ninguna intervención manual en la base o en la terminal.
