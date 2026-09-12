# Agent Instructions — AgroFácil

> **Hackathon (sept 2026): la app principal es Harvest.fi, la tokenización de cosecha sobre Solana.**
> Antes de tocar `backend/src/modules/tokenizadas`, `frontend/src/modules/tokenizadas` o `solana/agro_token`, leer **`HARVEST.md`**: decisión de arquitectura (custodial, Solana real en devnet), roles, flujo de la demo, endpoints, envs y trampas. Lo de abajo sigue siendo válido para el resto del código (unidades, convenciones, seguridad).

## Contexto del Proyecto

Estás trabajando en **AgroFácil**, una plataforma SaaS de gestión para productores agropecuarios argentinos. El MVP (Fase 1) le permite al productor cargar su campaña y obtener, por lote/cultivo/campaña, su **costo, margen (bruto y neto) y punto de equilibrio** expresados en USD y en quintales por hectárea (qq/ha).

- **Zona inicial**: núcleo agrícola de Córdoba, Argentina (Oliva y alrededores).
- **Usuario tipo**: productor que hoy lleva la campaña en planillas y WhatsApp. Carga datos **en el campo, con poca señal**.
- **Diferencial**: carga asistida por **voz/foto** parseada con la API de Claude → registro estructurado.
- **Fase 2 (no MVP)**: red de contratistas/servicios. No construir todavía.
- **Cliente cero**: el campo del fundador (soja, trigo, maíz) — toda decisión se valida ahí primero.

### Módulos del MVP (5)

| Módulo | Qué hace |
|---|---|
| **Campos y lotes** | Alta de establecimientos, lotes, superficie, tenencia y arrendamiento |
| **Campaña** | Crear campaña; asignar cultivo a cada lote (genera los `lote_campania`) |
| **Carga** | Registrar labores e insumos sobre un `lote_campania`. Manual + voz/foto |
| **Resultado del lote** | Costos, ingreso, márgenes (USD y qq/ha) y punto de equilibrio |
| **Resumen de campaña** | Totales por cultivo y por campaña; comparación entre lotes |

> **Fuente de verdad funcional**: `AgroFacil_MVP_Especificacion.docx` en la raíz. Si hay conflicto entre lo que dice ese documento y lo que está acá, gana el docx — y este archivo se actualiza.

---

## Stack Tecnológico

### Backend
| Tecnología | Uso |
|---|---|
| Node.js 20 LTS | Runtime |
| TypeScript 5 (strict) | Lenguaje |
| NestJS 10 | Framework HTTP |
| Prisma 5 | ORM + migraciones |
| PostgreSQL 15+ | Base de datos |
| Zod | Validación de DTOs |
| bcrypt + @nestjs/jwt | Auth (hash + JWT) |
| Passport (jwt strategy) | Guards de autenticación |
| openai | LLM del asistente (gpt-4o-mini, con visión y tool use). |
| Jest + Supertest | Testing |
| pino | Logging estructurado |

### Frontend
| Tecnología | Uso |
|---|---|
| React 18 + TypeScript | Framework UI |
| Vite | Build tool + dev server |
| Tailwind CSS | Estilos |
| shadcn/ui + lucide-react | Componentes + iconos |
| Zustand | State management ligero |
| TanStack Query | Data fetching / cache |
| React Hook Form + Zod | Formularios + validación |
| TanStack Table | Tablas |
| React Router v6 | Enrutamiento |
| Recharts | Gráficos (resultados/resumen) |
| PWA (vite-plugin-pwa) | Service worker + offline |

### Infraestructura
- Docker + Docker Compose (dev local: Postgres + backend + frontend)
- **Railway** (deploy): un servicio backend + Postgres + un servicio frontend
- Sin Kubernetes, sin microservicios, sin Celery/Redis en el MVP.

---

## Glosario y unidades (CRÍTICO — leer antes de escribir código)

La fuente número uno de bugs en este dominio es mezclar unidades. **Convención única para todo el sistema**:

| Concepto | Unidad |
|---|---|
| Superficie | **hectáreas (ha)** |
| Rinde | **quintales por hectárea (qq/ha)**. 1 qq = 100 kg |
| Tonelada | 1 tn = 1.000 kg = 10 qq |
| Precio del grano | Se ingresa en **USD/tn**. Internamente `precio_usd_qq = precio_usd_tn / 10` |
| Costos | Siempre en **USD** (totales y, derivado, USD/ha) |
| Moneda de análisis | **USD**. Si entra en pesos, se convierte con TC y se guarda el TC usado |

```typescript
// Conversión canónica — implementar UNA sola vez en un util y reutilizar.
// Nunca repetir esta cuenta inline en un service o componente.
export const precioUsdPorQq = (precioUsdPorTn: number) => precioUsdPorTn / 10;

export const produccionTn = (rindeQqHa: number, superficieHa: number) =>
  (rindeQqHa * superficieHa) / 10;

export const ingresoUsd = (
  rindeQqHa: number,
  superficieHa: number,
  precioUsdPorQq: number
) => rindeQqHa * superficieHa * precioUsdPorQq;
```

**Regla**: el dinero se guarda en `Decimal` de Prisma (`@db.Decimal(14, 4)`) para evitar errores de float. En TS, parsear a `number` solo en la capa de presentación.

---

## Modelo de datos (resumen — el detalle vive en el docx)

Entidad central: **`lote_campania`** (un cultivo sembrado en un lote durante una campaña). Todos los costos e ingresos cuelgan de ahí.

```
cuenta ──┐
         ├─< establecimiento ──< lote ──┐
         ├─< campania ──────────────────┤
         └─< usuario                    │
                                        ▼
        cultivo ───────────────────────> lote_campania ──< labor
                                                       └─< insumo_aplicado
```

**Convenciones obligatorias del esquema**:
- Toda tabla lleva `id` (uuid), `cuenta_id` (tenant), `created_at`, `updated_at`.
- **Soft delete** vía `activo: boolean` (default `true`). Nunca borrar registros físicamente.
- **Multi-tenant con Row Level Security**: cada query del request va filtrada por `cuenta_id` del usuario autenticado. Esto se aplica en un Prisma middleware (no se confía en el frontend ni en el filtro manual).
- Dinero: `Decimal(14, 4)`. Superficies y rindes: `Decimal(12, 4)`.
- Fechas: `DateTime` para timestamps; `Date` (sin hora) para `fecha_siembra`, `fecha_cosecha`, etc.

---

## Lógica de cálculo (el corazón del producto)

Todo se calcula **primero a nivel `lote_campania`** y luego se agrega. Implementación de referencia en `backend/src/modules/calculos/calculos.service.ts`.

### Costos
```
costo_insumos = Σ insumo_aplicado.costo_total_usd
costo_labores = Σ labor.costo_total_usd
costo_directo = costo_insumos + costo_labores

// Arrendamiento (solo si lote.tenencia = arrendado)
costo_arrendamiento =
  unidad = qq_ha          → valor * superficie * precio_usd_qq
  unidad = usd_ha         → valor * superficie
  unidad = pct_produccion → ingreso_bruto * (valor / 100)

costo_total    = costo_directo + costo_arrendamiento + otros_gastos
costo_total_ha = costo_total / superficie_ha
```

### Ingreso
```
rinde         = rinde_real_qq_ha ?? rinde_estimado_qq_ha  // real si existe
ingreso_bruto = rinde * superficie_ha * precio_usd_qq
```
Mientras no haya cosecha, el resultado se marca como **"proyectado"**. Al cargar el rinde real pasa a **"definitivo"**.

### Márgenes
```
margen_bruto       = ingreso_bruto - costo_directo
margen_bruto_ha    = margen_bruto / superficie_ha
margen_neto        = margen_bruto - costo_arrendamiento - otros_gastos
margen_neto_ha     = margen_neto / superficie_ha
margen_neto_qq_ha  = margen_neto_ha / precio_usd_qq   // expresado en grano
```

### Punto de equilibrio (rinde de indiferencia)
**El número estrella**: cuántos qq/ha hay que cosechar para cubrir todos los costos.
```
rinde_equilibrio_qq_ha = costo_total_ha / precio_usd_qq
margen_seguridad_qq    = rinde - rinde_equilibrio_qq_ha
```
Lectura para el usuario: *"Necesitás X qq/ha para no perder. Tu estimado es Y qq/ha."*

### Agregaciones (por cultivo, campaña, establecimiento)
**Sumar los totales en USD; recalcular los valores por hectárea sobre la superficie agregada. NUNCA promediar promedios.**

```typescript
const supTotal    = lotes.reduce((s, l) => s + l.superficie_ha, 0);
const ingreso     = lotes.reduce((s, l) => s + l.ingreso_bruto, 0);
const costo       = lotes.reduce((s, l) => s + l.costo_total, 0);
const margenNeto  = ingreso - costo;
const margenNetoHa = margenNeto / supTotal;  // <-- recalcular, no promediar
```

---

## Carga asistida por voz/foto

Es el feature que define la adopción del MVP. El productor dicta o saca foto → el sistema propone un registro estructurado → **el usuario confirma antes de guardar**. Nunca se persiste automáticamente.

### Flujo end-to-end
1. Usuario graba audio o sube foto desde la pantalla de **Carga**.
2. Audio → transcripción a texto (Whisper o equivalente). Foto → visión de Claude.
3. Texto + **contexto de la cuenta** (lotes existentes, cultivos, catálogo de insumos) van a la API de Claude pidiendo **solo un JSON** con el esquema definido.
4. El sistema parsea el JSON con `try/catch`, muestra un **borrador editable**.
5. El usuario confirma o corrige → recién ahí se persiste como `labor` o `insumo_aplicado`.

### Esquema de salida esperado
```json
{
  "tipo": "labor | insumo | cosecha",
  "lote": "Lote 4",
  "fecha": "2026-06-18",
  "detalle": {
    "tipo_labor": "pulverizacion",
    "producto": "glifosato",
    "cantidad": 3, "unidad": "lt",
    "superficie_ha": 80,
    "costo_total_usd": null,
    "forma_pago": null
  },
  "confianza": 0.0,
  "campos_faltantes": ["costo_total_usd"]
}
```

### Reglas de implementación
- Instruir al modelo a responder **únicamente con el JSON** (sin texto ni markdown).
- Parsear con `try/catch`; si falla, devolver al usuario para reintentar manualmente.
- Si `campos_faltantes` no está vacío → resaltar esos campos en el borrador.
- Si `confianza < 0.6` → mostrar banner *"Revisá con cuidado"* y pedir confirmación explícita.

---

## Principios de Desarrollo

### Arquitectura Backend (NestJS)
- **Capas**: `Controller` → `Service` → `Repository (Prisma)`.
- **NUNCA** lógica de negocio en controllers — solo orquestación HTTP.
- DTOs con **Zod** (no class-validator). Schema único reutilizable en backend y frontend si conviene.
- `@Injectable()` en services. **Prisma client** inyectado vía `PrismaModule`.
- **Multi-tenant guard**: Prisma middleware filtra por `cuenta_id` automáticamente.
- **Soft delete**: filtro automático `activo: true` en queries por defecto.
- **Auditoría mínima**: timestamps en escritura. Logger pino con `cuenta_id` y `user_id` en cada log.
- Transacciones (`prisma.$transaction`) para cualquier operación que toque > 1 tabla.

### Paleta visual (John Deere Green)
| Token | Hex | Uso |
|---|---|---|
| `primary` | `#047C00` | Botones primarios, links, acentos |
| `primary-light` | `#06820B` | Hover/active states del primario |
| `accent` | `#0F7702` | Botones secundarios, badges destacados |
| `sidebar` | `#047C00` | Sidebar (con texto blanco) |
| `background` | `#F8FAFC` | Fondo del contenido |
| `surface` | `#FFFFFF` | Cards, modales |
| `text-primary` | `#0F172A` | Texto principal |
| `text-secondary` | `#64748B` | Labels, placeholders |
| `border` | `#E2E8F0` | Bordes, divisores |

### Arquitectura Frontend (React)
- Componentes chicos y reutilizables.
- Custom hooks para data fetching (`use{Modulo}`).
- Separación: `components/` → `pages/` → `services/` → `stores/` → `hooks/`.
- **TypeScript strict siempre**. Nunca `any`. Si no se puede tipar, `unknown` + narrow.
- Loading + error states en toda operación async.
- **Mobile-first**: el productor va a usar esto desde el celular en el campo.
- **Offline-first en la pantalla de Carga**: registros se guardan en IndexedDB y se sincronizan al recuperar señal.

### Formato Argentino
```typescript
// Fechas: DD/MM/YYYY
const formatearFecha = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-AR');

// Moneda USD (mostrar con separadores AR)
const formatearUsd = (monto: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(monto);

// qq/ha — formato propio del agro
const formatearQqHa = (valor: number) =>
  `${valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} qq/ha`;
```

---

## Estructura de Archivos

### Backend (NestJS — nuevo módulo)
```
backend/src/modules/{modulo}/
├── dto/
│   ├── crear-{modulo}.dto.ts
│   ├── actualizar-{modulo}.dto.ts
│   └── {modulo}-response.dto.ts
├── {modulo}.controller.ts
├── {modulo}.service.ts
├── {modulo}.module.ts
└── tests/
    ├── {modulo}.service.spec.ts
    └── {modulo}.controller.spec.ts
```

El schema Prisma vive en uno solo: `backend/prisma/schema.prisma`. Las entidades se agregan ahí, no por módulo.

### Frontend (React — nuevo módulo)
```
frontend/src/
├── components/{modulo}/
│   ├── {Modulo}List.tsx
│   ├── {Modulo}Form.tsx
│   ├── {Modulo}Detail.tsx
│   └── index.ts
├── pages/{modulo}/
│   ├── index.tsx
│   ├── nuevo.tsx
│   └── [id].tsx
├── hooks/use{Modulo}.ts
├── services/{modulo}Service.ts
└── types/{modulo}.ts
```

---

## Convenciones de Código

### TypeScript (back y front)
```typescript
// Nombres descriptivos en español argentino — variables, funciones, comentarios, copy.
// Interfaces y tipos en PascalCase. Funciones y variables en camelCase.

interface LoteCampaniaFormData {
  loteId: string;
  campaniaId: string;
  cultivoId: string;
  superficieSembradaHa: number;
  fechaSiembra: string;
  rindeEstimadoQqHa: number;
  precioGranoUsdTn: number;
}

// Nunca 'any'. Si no sabés el tipo, 'unknown' + narrow con guards.
// Tipar SIEMPRE el retorno de funciones públicas.
async function calcularResultadoLote(
  loteCampaniaId: string,
): Promise<ResultadoLoteDto> {
  // ...
}
```

### Naming en BD (Prisma)
- Tablas: `snake_case` plural en español (`lotes_campania`, `insumos_aplicados`).
- Campos: `snake_case` en español (`superficie_ha`, `costo_total_usd`).
- En TS, Prisma genera el client en `camelCase` automáticamente (`superficieHa`, `costoTotalUsd`) usando `@@map` y `@map`.

---

## Seguridad (CRÍTICO)

- ✅ Passwords con **bcrypt** (cost 12 mínimo).
- ✅ JWT con expiración (`access`: 30 min, `refresh`: 7 días). Refresh rota en cada uso.
- ✅ Validación Zod en TODO input HTTP.
- ✅ **Tenant isolation**: Prisma middleware filtra por `cuenta_id`. Tests automáticos validan que la cuenta A no ve datos de la cuenta B.
- ✅ Rate limiting en `/auth/login` y `/auth/refresh` (`@nestjs/throttler`).
- ✅ Sanitización de inputs (DTOs con `.trim()`, etc.).
- ✅ Logs sin info sensible (passwords, tokens, datos personales nunca en logs).
- ✅ Soft delete en todas las entidades.
- ✅ CORS restringido al origin del frontend.
- ✅ Secrets solo en `.env` (NUNCA hardcodeados ni commiteados). `.env.example` lista las variables sin valor.

---

## Comandos Útiles

```bash
# Backend
cd backend
npm install
npm run start:dev               # nest start --watch
npx prisma migrate dev          # crear/aplicar migración
npx prisma studio               # GUI BD
npm run test
npm run test:e2e

# Frontend
cd frontend
npm install
npm run dev                     # vite dev
npm run build
npm run lint
npm run test                    # vitest

# Docker (desarrollo local completo)
docker compose up -d            # Postgres + backend + frontend
docker compose logs -f backend

# Prisma
npx prisma generate             # regenerar client tras editar schema
npx prisma migrate reset        # reset DB (solo dev)
```

---

## Decisiones de negocio pendientes (D1–D5)

Estas son del lado del negocio — las define el fundador. **No escribir migraciones definitivas hasta que estén confirmadas** (sec. 9 del docx).

| # | Pregunta | Default propuesto |
|---|---|---|
| D1 | Arrendamiento: ¿`qq/ha`, `usd/ha` o `% producción`? ¿Mixto en una misma cuenta? | Soportar las 3 unidades, marcar el lote |
| D2 | Precio del grano: ¿NETO (FAS) o BRUTO? | NETO (más simple para el MVP) |
| D3 | Labores propias: ¿se imputa costo de oportunidad o solo contratistas? | Por ahora solo contratistas; campo `costo_total_usd` opcional |
| D4 | Canje: ¿USD + etiqueta, o equivalente en quintales? | USD + etiqueta `forma_pago = canje` |
| D5 | Moneda: ¿USD único o permitir pesos con TC? | USD único en el MVP |

Estas decisiones impactan directamente las fórmulas de la sección "Lógica de cálculo".

---

## Fases de Desarrollo (90 días)

| Semanas | Foco | Entregable |
|---|---|---|
| 1–2 | **Setup + Auth** | Monorepo, Docker, NestJS, React, JWT, login, multi-tenant base |
| 3–4 | **Campos y lotes + Campaña** | CRUD establecimientos, lotes, campañas, asignación de cultivo |
| 5–6 | **Carga (manual)** | Labores e insumos, formularios mobile-first, lista por lote |
| 7–8 | **Resultado + Resumen** | Cálculos de costos/margen/punto eq., pantallas de resultados |
| 9–10 | **Voz/foto + IA** | Integración API Claude, transcripción, borrador editable |
| 11–12 | **Offline + PWA** | Service worker, IndexedDB, sincronización |
| 13 | **Dogfood + deploy** | Campo del fundador, deploy a Railway, primeros 5–10 usuarios |

**Métrica que importa**: cuántos productores completan una campaña entera cargando y vuelven a la siguiente. Si retenemos a través de una campaña, hay producto.

---

## Cómo trabajar con este agente

- Cualquier pregunta de negocio que no esté resuelta acá o en el docx → **preguntar al usuario antes de inventar**. El dominio agro tiene reglas no obvias y un error de fórmula invalida la confianza del usuario.
- Antes de escribir una migración Prisma, confirmar que las decisiones D1–D5 que toca esa tabla están definidas.
- Siempre que toques unidades (qq, ha, USD, tn), revisar contra el glosario de este archivo.
- Si encontrás una fórmula duplicada, refactorizar a un util compartido. La cuenta tiene que estar en un solo lugar.
- Comandos disponibles bajo `.claude/commands/`. Usar `/setup-proyecto`, `/crear-modulo-backend`, `/crear-crud-completo`, etc.
