# AgroFácil · Campañas Tokenizadas

Módulo nuevo sobre la base de AgroFácil. Permite que el dueño de un campo tokenice una porción de su campaña y que inversores compren esa producción a futuro.

Este documento cubre **interfaces y front únicamente**. La capa blockchain, los contratos y la custodia quedan fuera de alcance: se modelan como un servicio opaco detrás de una interfaz (`LedgerService`) que en esta fase devuelve mocks.

---

## 1. Alcance

### Dentro

- Perfil y flujos del **dueño de campo** (productor): alta de campo, alta de campaña, configuración de la tokenización, seguimiento.
- Perfil y flujos del **inversor**: marketplace de campañas, ficha de detalle, simulación, compra, portfolio.
- Visualización de datos técnicos del lote: clima, suelo, NDVI, histórico de precios.
- Motor de cotización del token (cálculo en front + validación en back).
- Estados de campaña y su representación visual.

### Fuera

- Contratos inteligentes, wallets, firma onchain, stablecoins.
- KYC real, rampa fiat, procesamiento de pagos reales.
- Integración **en vivo** con los webservices de ARCA (CPE / CTG / LPG). La conciliación de movimientos sí se construye (sección 9), pero en esta fase los CTG entran por el portal del acopio o por carga manual; el cliente de ARCA queda detrás de su interfaz, mockeado.
- Cascada de garantías y liquidación con seguros / SGR — se muestra como información, no se opera.

### Contrato con la capa que no construimos

Todo lo que toca dinero o registro de propiedad pasa por una única interfaz:

```ts
interface LedgerService {
  reservarTokens(campanaId: string, cantidad: number, inversorId: string): Promise<Reserva>;
  confirmarCompra(reservaId: string): Promise<Tenencia>;
  obtenerTenencias(inversorId: string): Promise<Tenencia[]>;
  obtenerDisponibilidad(campanaId: string): Promise<{ emitidos: number; vendidos: number }>;
}
```

En esta fase hay una única implementación: `MockLedgerService`, con latencia artificial y persistencia en la base propia. Cuando entre la blockchain, se cambia la implementación y **no se toca una sola pantalla**.

---

## 2. Base: qué se reutiliza de AgroFácil

Antes de escribir código, auditar qué existe hoy y anotarlo acá:

- [ ] Modelo de `Campo` / `Lote` — ¿tiene geometría? ¿superficie? ¿ubicación?
- [ ] Modelo de `Campaña` / `Ciclo` — ¿existe el concepto de campaña con cultivo, fecha de siembra y cosecha estimada?
- [ ] Modelo de `Cultivo` y rindes históricos.
- [ ] Sistema de usuarios y roles — qué roles hay y cómo se resuelven los permisos.
- [ ] Módulo de comercialización — el flujo de solicitud de venta y aprobación por superadmin.
- [ ] ¿Existe alguna entidad de acopio, depósito o destino? ¿Se registran movimientos de grano o cartas de porte?
- [ ] Componentes de gráficos ya construidos (Recharts).
- [ ] Layout / shell de la aplicación.

**Regla:** extender las entidades existentes, no duplicarlas. Una campaña tokenizada **es** una campaña de AgroFácil con una `Tokenizacion` asociada. Si hoy no existe `Campaña`, crearla primero como entidad de dominio propia y recién después colgarle la tokenización.

### Stack

El mismo de AgroFácil:

- **Backend**: Node 20 · NestJS 10 · Prisma 5 · PostgreSQL 15 · Zod · JWT · pino
- **Frontend**: React 18 · Vite · TypeScript · Tailwind · shadcn · TanStack Query · React Hook Form · Zod · Recharts
- **Agregados para este módulo**: `react-leaflet` + `leaflet-draw` (mapas y dibujo de polígonos), `@turf/turf` (cálculo de superficie), `date-fns`

---

## 3. Roles

| Rol | Qué ve |
|---|---|
| `PRODUCTOR` | Sus campos, sus campañas, sus tokenizaciones, quiénes le invirtieron |
| `INVERSOR` | Marketplace completo, fichas de campaña, su portfolio |
| `ACOPIO` | Solo las campañas afectadas a sus plantas — en toneladas, sin datos financieros |
| `ADMIN` | Todo, más la aprobación de campañas antes de publicarse |

Un mismo usuario puede tener los roles `PRODUCTOR` e `INVERSOR` a la vez. El shell muestra un switch de contexto arriba a la izquierda cuando eso pasa; no se duplican cuentas. `ACOPIO` es excluyente: pertenece a una organización externa y nunca se combina con los otros dos.

**Aprobación:** ninguna campaña llega al marketplace sin pasar por `ADMIN`. Esto existe desde el día uno porque replica el control que ya tiene el módulo de comercialización actual y porque es la única barrera de calidad del catálogo.

---

## 4. Modelo de datos

Tipos de front. El schema de Prisma se deriva de esto.

```ts
type EstadoCampana =
  | 'BORRADOR'        // el productor la está armando
  | 'EN_REVISION'     // enviada, esperando ADMIN
  | 'RECHAZADA'
  | 'ABIERTA'         // publicada, se pueden comprar tokens
  | 'FONDEADA'        // se vendió todo lo emitido
  | 'EN_CURSO'        // sembrada, creciendo
  | 'EN_COSECHA'
  | 'LIQUIDADA'
  | 'CANCELADA';

type ModoTokenizacion =
  | { modo: 'PORCENTUAL'; porcentaje: number }   // 30% de lo que se produzca
  | { modo: 'FIJO'; toneladas: number };         // 300 tn, pase lo que pase

interface Campo {
  id: string;
  productorId: string;
  nombre: string;
  partido: string;
  provincia: string;
  geometria: GeoJSON.Polygon;      // dibujado en el mapa
  superficieHa: number;            // calculada con turf, editable manualmente
  tipoTenencia: 'PROPIO' | 'ARRENDADO';
  acopioHabitualId?: string;
  fotos: string[];
}

interface Campana {
  id: string;
  campoId: string;
  cultivo: 'SOJA' | 'MAIZ' | 'TRIGO' | 'GIRASOL';
  cicloAgricola: string;           // "2026/27"
  hectareasAfectadas: number;
  fechaSiembraEstimada: string;
  fechaCosechaEstimada: string;
  rindeEstimadoTnHa: number;
  produccionEstimadaTn: number;    // derivado: ha × rinde
  estado: EstadoCampana;
}

interface Tokenizacion {
  id: string;
  campanaId: string;
  modo: ModoTokenizacion;
  toneladasOfrecidas: number;      // derivado del modo
  tokensEmitidos: number;          // 1 token = 1 tonelada
  tokensVendidos: number;

  // cotización
  fuentePrecio: 'PIZARRA_ROSARIO' | 'MATBA_FUTURO' | 'MANUAL';
  precioReferencia: number;        // USD/tn
  descuentoPct: number;            // lo que el productor cede
  precioToken: number;             // derivado: referencia × (1 - descuento)
  moneda: 'USD';

  // ventana de fondeo
  fondeoDesde: string;
  fondeoHasta: string;
  montoObjetivo: number;           // derivado
  montoRecaudado: number;

  // garantías (informativo en esta fase)
  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  sobrecolateralPct: number;
}

interface Tenencia {
  id: string;
  inversorId: string;
  campanaId: string;
  tokens: number;
  precioCompra: number;            // congelado al momento de comprar
  fechaCompra: string;
  estado: 'ACTIVA' | 'LIQUIDADA' | 'EN_DISPUTA';
}

interface DatosTecnicos {
  campoId: string;
  suelo: {
    textura: string;               // franco limoso, etc.
    materiaOrganicaPct: number;
    ph: number;
    capacidadRetencionMm: number;
    fuente: string;
  };
  climaHistorico: {
    precipitacionMensualMm: { mes: string; mm: number; promedioHistorico: number }[];
    temperaturaMediaC: { mes: string; c: number }[];
  };
  ndvi: { fecha: string; valor: number }[];
  rindesHistoricos: { ciclo: string; cultivo: string; tnHa: number }[];
}
```

### Los dos modos, y por qué importan en la UI

Esta es la decisión de producto más delicada del módulo. No es cosmética: **cambia quién asume el riesgo de rinde.**

| | `PORCENTUAL` | `FIJO` |
|---|---|---|
| Qué compra el inversor | Una fracción de lo que se produzca | Una cantidad determinada de toneladas |
| Si el rinde cae | El inversor recibe menos toneladas | El productor tiene que entregar igual |
| Si el rinde sube | El inversor recibe más | El productor se queda el excedente |
| Riesgo del inversor | Alto | Bajo |
| Riesgo del productor | Bajo | Alto |
| Descuento esperable | Mayor | Menor |

**La UI tiene que hacer esto obvio en los dos lados.** No alcanza con un select. En el alta, el productor ve un comparador lado a lado con su propia estimación cargada. En el marketplace, cada campaña lleva un badge permanente y la ficha explica en una línea qué significa para quien compra.

En modo `PORCENTUAL`, el token no puede decir "1 tonelada". Dice **"1 unidad = 1/N de la producción"**, y toda la UI de retorno se muestra como rango, nunca como número único.

---

## 5. Rutas

```
/                                   landing pública
/ingresar
/registro

── PRODUCTOR ──────────────────────────────────
/campos                             listado de campos
/campos/nuevo                       wizard de alta (mapa)
/campos/:id                         ficha del campo
/campos/:id/editar

/campanas                           listado de campañas
/campanas/nueva                     wizard de alta + tokenización
/campanas/:id                       panel de la campaña
/campanas/:id/tokenizacion          configuración de la oferta
/campanas/:id/inversores            quiénes compraron
/campanas/:id/avance                carga de hitos y evidencia

── INVERSOR ───────────────────────────────────
/invertir                           marketplace
/invertir/:campanaId                ficha de campaña
/invertir/:campanaId/comprar        flujo de compra
/portfolio                          tenencias
/portfolio/:tenenciaId              detalle y seguimiento

── ACOPIO ─────────────────────────────────────
/acopio                             tablero de la planta
/acopio/recepcion                   alta de camión entrante
/acopio/posiciones                  campañas afectadas a mis plantas
/acopio/posiciones/:afectacionId
/acopio/liberaciones                qué puedo entregar al productor
/acopio/certificaciones

── ADMIN ──────────────────────────────────────
/admin/revision                     cola de campañas a aprobar
/admin/revision/:campanaId
/admin/campanas
/admin/acopios                      red de acopios aliados
/admin/acopios/:id
/admin/conciliacion                 bandeja de desvíos y huérfanos
```

---

## 6. Dirección visual

> Si AgroFácil ya tiene identidad definida, el panel del productor la mantiene. Lo de abajo es para la **superficie del inversor**, que es pública y tiene otra audiencia. Dos pieles, componentes compartidos.

El producto vive entre dos mundos: el lote real y el mercado de granos. La identidad sale de ahí, no de la estética fintech genérica.

### Color

```css
--papel:    #FBFBF7;   /* fondo, blanco apenas cálido */
--tinta:    #1B2420;   /* texto, verde muy oscuro */
--campo:    #2F6B4F;   /* verde de lote — acento primario */
--surco:    #8A6A3B;   /* ocre de suelo arado — acento secundario */
--dato:     #1E5F8C;   /* azul frío — reservado para cifras financieras */
--alerta:   #B0442F;
--neutro:   #6B7570;
```

El azul `--dato` se usa **exclusivamente** para números de plata. Verde y ocre para lo agronómico. Esa separación cromática es la que le enseña al usuario, sin leyenda, qué está mirando.

### Tipografía

Una sola familia: **Archivo** (variable, Google Fonts). Cubre display y UI sin necesidad de una segunda.

- Títulos: 600, tracking `-0.02em`
- Cuerpo: 400, máximo 72 caracteres de línea
- **Todas las cifras con `font-variant-numeric: tabular-nums`.** Es un producto de números en tablas; sin esto las columnas bailan.

Sin labels en mayúsculas. Sin eyebrows sobre cada título. Sin flechitas al final de los botones.

### Layout

El marketplace no es una grilla de cards idénticas. La ficha de campaña es el corazón del producto y merece una estructura propia: **mapa satelital a sangre arriba** con los datos superpuestos, y debajo el contenido en dos columnas — izquierda la narrativa agronómica, derecha el panel de compra pegado (`sticky`).

```
┌──────────────────────────────────────────────┐
│                                              │
│   [ mapa satelital del lote, a sangre ]      │
│   Lote La Escondida · 240 ha · Soja          │
│                                              │
├────────────────────────────┬─────────────────┤
│                            │  ┌───────────┐  │
│  Clima                     │  │  COMPRAR  │  │
│  Suelo                     │  │  sticky   │  │
│  NDVI                      │  │           │  │
│  Rindes históricos         │  │ USD 288   │  │
│  Precio de pizarra         │  │ /tonelada │  │
│  Garantías                 │  │           │  │
│  El productor              │  │ [ - 10 +] │  │
│                            │  │           │  │
│                            │  │ Simular   │  │
│                            │  └───────────┘  │
└────────────────────────────┴─────────────────┘
```

### Un principio

**Ningún número financiero aparece sin su supuesto al lado.** Si la pantalla dice "retorno estimado 7,5%", inmediatamente debajo, en texto chico, dice sobre qué precio de soja está calculado. Es un producto donde la confianza es el activo; una cifra sin contexto la destruye.

---

## 7. Pantallas · Productor

### 7.1 Alta de campo — wizard de 3 pasos

**Paso 1 · Ubicación**

Mapa a pantalla completa (`react-leaflet`, capa satelital Esri World Imagery). El productor:

- Busca por localidad o navega.
- Dibuja el polígono del lote con `leaflet-draw`.
- La superficie se calcula sola con `@turf/area` y se muestra en vivo mientras dibuja.
- Puede corregir la superficie a mano si su medición difiere; queda registrado que fue manual.

Alternativa obligatoria: **importar KML/KMZ o shapefile**. Muchos productores ya tienen el lote dibujado en otra herramienta y redibujarlo es fricción pura.

**Paso 2 · Identificación**

Nombre del lote, partido, provincia, tipo de tenencia, acopio habitual, fotos.

**Paso 3 · Historial**

Rindes de los últimos ciclos, cultivo por ciclo. Opcional pero con copy que explique por qué conviene: *"Los campos con historial cargado se fondean más rápido."*

Al guardar, disparar en background la carga de `DatosTecnicos` (clima histórico + suelo) desde las APIs externas. El productor no espera.

---

### 7.2 Alta de campaña y tokenización — wizard de 4 pasos

Este es **el flujo más importante del módulo**. Si es confuso, no hay oferta.

**Paso 1 · La campaña**

Campo, cultivo, ciclo, hectáreas afectadas, fechas de siembra y cosecha, rinde estimado.

Al cargar el rinde, mostrar al costado el promedio histórico del campo y el promedio zonal. Si la estimación del productor se va más de un 15% por encima, un aviso suave: *"Estás estimando por encima de tu promedio de los últimos 5 ciclos."* Aviso, no bloqueo.

Salida del paso: **producción estimada en toneladas**, grande, como resultado.

**Paso 2 · Cuánto tokenizar**

Dos tarjetas grandes, lado a lado, con el número real del productor ya adentro:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  Un porcentaje          │  │  Una cantidad fija      │
│                         │  │                         │
│  ●────────── 30%        │  │  [    300    ] tn       │
│                         │  │                         │
│  ≈ 300 tn hoy           │  │  30% de tu estimación   │
│                         │  │                         │
│  Si el rinde cae,       │  │  Tenés que entregar     │
│  entregás menos.        │  │  las 300 aunque el      │
│  Si sube, entregás más. │  │  rinde caiga.           │
│                         │  │                         │
│  Menor riesgo para vos  │  │  Mayor riesgo para vos  │
│  Mayor descuento        │  │  Menor descuento        │
└─────────────────────────┘  └─────────────────────────┘
```

Debajo, un slider de rinde real que mueve los dos números a la vez. El productor arrastra a "rinde 30% peor" y ve en la tarjeta izquierda que entregaría 210 tn y en la derecha que sigue debiendo 300. **Ese movimiento es la explicación**; el texto solo acompaña.

**Paso 3 · Cotización**

Fuente de precio: pizarra de Rosario, futuro MATBA, o manual. Al elegir, el precio se autocompleta y se muestra el gráfico de los últimos 12 meses de esa serie.

Luego un slider de descuento (0–20%) con feedback inmediato:

| Se muestra | Valor |
|---|---|
| Precio de referencia | USD 310/tn |
| Descuento | 7% |
| **Precio por token** | **USD 288,30** |
| Tokens a emitir | 300 |
| **Vas a recibir** | **USD 86.490** |
| Costo de tu financiamiento | USD 6.510 · 15,5% anual en USD |

Esa última fila es la que cierra la venta interna. El productor no piensa en "descuento", piensa en "a qué tasa me estoy financiando". Mostrarle las dos cosas.

**Cotización dinámica (configurable):** switch para que el precio del token siga la pizarra durante la ventana de fondeo en lugar de quedar fijo. Si se activa, el productor define un piso. Los tokens ya vendidos **nunca** cambian de precio: el precio se congela por tenencia al momento de la compra.

**Paso 4 · Garantías y revisión**

Checks de seguro de granizo, seguro paramétrico, aval SGR, sobrecolateralización. Cada uno con upload de comprobante y con una línea de por qué mejora la oferta.

Un medidor de completitud ("Tu oferta está al 60% de lo que los inversores buscan") con las acciones que faltan. Gamificación mínima, pero sube muchísimo la calidad del catálogo.

Vista previa exacta de cómo se va a ver la campaña en el marketplace, y botón **Enviar a revisión**.

---

### 7.3 Panel de campaña

Header con estado y barra de fondeo. Tabs:

- **Resumen** — tokens vendidos/emitidos, monto recaudado, días restantes, curva de fondeo en el tiempo.
- **Inversores** — tabla de quiénes compraron, cuánto, cuándo. Con nombres visibles: el productor tiene que saber a quién le debe.
- **Avance** — timeline de hitos (siembra, emergencia, estado fenológico, aplicaciones, cosecha). El productor sube foto y nota. **Esto alimenta directo la ficha del inversor y es lo que sostiene la confianza durante los seis meses en que no pasa nada.**
- **Datos técnicos** — clima y NDVI en vivo del lote.
- **Liquidación** — solo visible en estado `EN_COSECHA` o posterior.

---

## 8. Pantallas · Inversor

### 8.1 Marketplace `/invertir`

**Filtros** (barra lateral izquierda, colapsable en mobile): cultivo, provincia, modo de tokenización, rango de precio por token, ventana de cosecha, descuento mínimo, garantías presentes.

**Orden**: cierra pronto · mayor descuento · menor riesgo · recién publicadas.

**La card de campaña** — el elemento más repetido del producto, hay que hacerlo bien:

```
┌────────────────────────────────────┐
│ [ miniatura satelital del lote ]   │
│                            ● FIJO  │
├────────────────────────────────────┤
│ La Escondida · Pergamino, BA       │
│ Soja · 240 ha · cosecha may 2027   │
│                                    │
│ USD 288,30 / tonelada              │
│ 7% bajo pizarra                    │
│                                    │
│ ████████████░░░░░  68% fondeado    │
│ 204 de 300 tn · cierra en 12 días  │
│                                    │
│ 🛡 granizo · paramétrico · SGR     │
└────────────────────────────────────┘
```

La miniatura es el lote real desde satélite, no un stock photo de un campo genérico. Es el activo. Que se vea.

**Estado vacío:** si los filtros no devuelven nada, no mostrar "sin resultados". Mostrar qué filtro sacar para tener resultados, con el botón que lo saca.

---

### 8.2 Ficha de campaña `/invertir/:id`

El mapa a sangre arriba, y abajo las secciones en este orden. El orden importa: **primero el activo, después el número.**

**a. El lote**
Mapa satelital con el polígono. Toggles de capa: satélite / NDVI / relieve. Superficie, partido, distancia al acopio.

**b. Clima**
- Precipitación mensual del ciclo actual contra el promedio histórico de 10 años (barras superpuestas). Es el gráfico que más mira un inversor con algo de conocimiento.
- Temperatura media.
- Pronóstico a 14 días.
- Un indicador de déficit hídrico acumulado, con su umbral marcado.

**c. Suelo**
Textura, materia orgánica, pH, capacidad de retención hídrica. Cada valor con su fuente citada y comparado contra el rango típico de la zona. Sin fuente, el dato no va.

**d. Trayectoria del cultivo**
NDVI del lote en el tiempo, contra la curva típica del cultivo. Cuando la campaña está `EN_CURSO`, acá se ve si la cosa viene bien o viene mal, y es la principal razón por la que un inversor vuelve a entrar a la plataforma.

**e. Historial de rindes**
Barras por ciclo, con el promedio zonal como línea de referencia.

**f. Precio de pizarra**
Serie histórica del cultivo, 24 meses. Marcados: el precio de referencia de esta campaña, el precio del token (por debajo), y la fecha estimada de cosecha. El gap visual entre la línea de pizarra y la línea del token **es el producto**. Que se vea de un vistazo.

**g. Simulador**

El componente que convierte visitantes en compradores. Un slider de precio de soja a cosecha, y en tiempo real:

- Lo que recibiría
- Su ganancia o pérdida
- El porcentaje de retorno
- El punto de equilibrio, marcado en el slider

En modo `PORCENTUAL`, se agrega un **segundo slider de rinde**, y el resultado se muestra como rango, nunca como cifra única.

**h. Garantías**
Lista de lo que cubre cada instrumento presente, en lenguaje llano. Y —esto es importante— **lo que no cubre**. Un inversor que se entera del riesgo después es un inversor perdido y un problema legal.

**i. El productor**
Nombre, zona, años de actividad, campañas anteriores en la plataforma y cómo terminaron. La reputación acumulada es el activo de largo plazo del negocio; empezá a construirla desde la primera campaña.

**Panel de compra sticky** (columna derecha, todo el scroll):
precio por token · input de cantidad con `- / +` · total en vivo · tokens disponibles · countdown de cierre · botón **Comprar tokens**.

---

### 8.3 Flujo de compra

Sheet lateral, tres pasos, sin cambio de página:

1. **Cantidad** — cuánto, total, qué representa sobre la producción total.
2. **Confirmación** — resumen completo, escenarios de retorno, y una casilla explícita de comprensión del riesgo. El texto de esa casilla lo escribe un abogado, no nosotros; dejar el slot.
3. **Listo** — comprobante, número de operación, acceso al portfolio.

Entre el paso 1 y el 2, `LedgerService.reservarTokens()` con un TTL de 10 minutos y countdown visible. Evita sobreventa cuando dos inversores compran al mismo tiempo las últimas toneladas.

---

### 8.4 Portfolio `/portfolio`

**Arriba:** invertido total, valor actual estimado, retorno no realizado, toneladas totales por cultivo.

El valor actual estimado se recalcula con la pizarra del día. **Etiquetarlo siempre como estimado** y aclarar sobre qué precio está calculado.

**Tabla de tenencias:** campaña, cultivo, tokens, precio de compra, valor actual, variación, estado, días a cosecha.

**Detalle de tenencia:** la misma ficha de campaña más el avance que carga el productor, la evolución del valor de la posición desde la compra, y los documentos de la operación.

**Novedades:** feed cronológico de hitos de las campañas en las que el inversor está adentro. Es la razón por la que vuelve entre la siembra y la cosecha.

---

## 9. Custodia y acopio

### 9.1 El modelo: alianza, no operación propia

**No somos acopio.** No tenemos planta, no nos inscribimos en SISA como operador con planta y no custodiamos grano físico. Controlamos el flujo de información y de plata; el grano lo custodia un acopio aliado con planta habilitada.

Consecuencias directas sobre el producto:

- El acopio es **un actor con cuenta en el sistema**, no un campo de texto en la ficha del campo.
- **Ninguna campaña se publica sin un acopio aliado asignado y con convenio marco firmado.** Es una validación bloqueante en el wizard, no un aviso.
- Arrancamos con 2 o 3 acopios de una misma zona. Densidad geográfica antes que cobertura nacional: sin densidad no hay logística ni poder de negociación.

**Qué gana el acopio** — esto define el copy de su onboarding y el pitch comercial: cada campaña financiada es mercadería que entra a su planta y que, si no, iba a otro lado. No es un favor, es originación de volumen.

### 9.2 Rol nuevo

| Rol | Qué ve |
|---|---|
| `ACOPIO` | Solo las campañas afectadas a sus propias plantas |

**Límite de visibilidad, no negociable:** el acopio ve **toneladas**. Nunca ve inversores, montos recaudados, precios de token, descuentos ni retornos. La información financiera de la campaña no sale del circuito productor–plataforma–inversor.

Un usuario `ACOPIO` pertenece a una organización `Acopio` y puede tener asignada una o varias plantas. El operador de balanza tiene un sub-rol con acceso únicamente a Recepción.

### 9.3 Modelo de datos

```ts
interface Acopio {
  id: string;
  razonSocial: string;
  cuit: string;
  sisaEstado: 1 | 2 | 3 | 4;              // solo se opera con 1 o 2
  sisaUltimaVerificacion: string;
  plantas: Planta[];
  convenioMarcoFirmado: boolean;
  convenioUrl?: string;
  nivelIntegracion: 'MANUAL' | 'PORTAL' | 'API' | 'ARCA_DELEGADO';
  campanasActivas: number;
  toneladasEnCustodia: number;
}

interface Planta {
  id: string;
  acopioId: string;
  numeroPlantaSisa: string;
  localidad: string;
  provincia: string;
  coordenadas: { lat: number; lng: number };
  capacidadTn: number;
  activa: boolean;
}

interface AfectacionGrano {              // el vínculo campaña ↔ acopio
  id: string;
  campanaId: string;
  acopioId: string;
  plantaId: string;
  toneladasComprometidas: number;        // lo que el productor prometió
  toneladasRecibidas: number;            // lo que efectivamente entró
  toneladasLiberadas: number;            // lo que volvió al productor
  toneladasAfectadas: number;            // derivado: recibidas - liberadas
  estado: 'VIGENTE' | 'CUMPLIDA' | 'INCUMPLIDA' | 'EN_DISPUTA';
  cesionNotificada: boolean;
  fechaNotificacion?: string;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
}

interface MovimientoGrano {
  id: string;
  ctg: string;                           // Código de Trazabilidad de Granos
  cpeNumero: string;
  campanaId?: string;                    // null si no se pudo conciliar
  afectacionId?: string;
  fechaEmision: string;
  origenCuit: string;
  destinoCuit: string;
  destinoPlantaSisa?: string;
  toneladasDeclaradas: number;
  toneladasPesadas?: number;
  humedadPct?: number;
  mermaTn?: number;
  estadoConciliacion: 'PENDIENTE' | 'CONCILIADO' | 'DESVIO' | 'HUERFANO';
  observaciones?: string;
}

interface CertificacionDeposito {
  id: string;
  numeroComprobante: string;             // el comprobante electrónico
  afectacionId: string;
  movimientoId: string;
  toneladas: number;
  fecha: string;
  archivoUrl: string;
  cargadaPor: 'ACOPIO' | 'ADMIN' | 'API';
}

interface Liberacion {
  id: string;
  afectacionId: string;
  toneladas: number;
  motivo: 'EXCEDENTE' | 'CAMPANA_LIQUIDADA' | 'AUTORIZACION_ADMIN';
  autorizadaPor: string;
  fecha: string;
}
```

`AfectacionGrano` es la entidad central del módulo. Es el equivalente digital de la prenda: **dice qué parte del grano que está en ese silo no es libre.**

### 9.4 Rutas

```
── ACOPIO ─────────────────────────────────────
/acopio                             tablero de la planta
/acopio/recepcion                   alta de camión entrante
/acopio/posiciones                  campañas afectadas a mis plantas
/acopio/posiciones/:afectacionId    detalle y movimientos
/acopio/liberaciones                qué puedo entregar al productor
/acopio/certificaciones             comprobantes emitidos

── ADMIN (agregados) ──────────────────────────
/admin/acopios                      red de acopios aliados
/admin/acopios/:id                  ficha, plantas, convenio, SISA
/admin/conciliacion                 bandeja de desvíos y huérfanos
```

### 9.5 Pantallas del portal del acopio

Diseñadas para el operador de balanza, no para un contador. Tipografía grande, pocos campos, funciona con una mano y con guantes.

**Recepción** — la pantalla que más se usa, la que hay que hacer impecable.

El operador ingresa el CTG del camión (escaneo de QR o tipeo). El sistema resuelve contra las afectaciones vigentes y responde en grande, antes de pedir cualquier otro dato:

```
┌──────────────────────────────────────────┐
│  CTG 10234567890                         │
│                                          │
│  ● AFECTADO AL FIDEICOMISO               │
│                                          │
│  Campaña La Escondida · Soja             │
│  Productor: J. Pérez                     │
│                                          │
│  Recibido:   204 tn                      │
│  Pendiente:   96 tn                      │
│                                          │
│  ─────────────────────────────────       │
│  Peso bruto   [        ] kg              │
│  Tara         [        ] kg              │
│  Humedad      [        ] %               │
│  Merma        [        ] kg              │
│                                          │
│  Neto: —                                 │
│                                          │
│  [ Confirmar recepción ]                 │
└──────────────────────────────────────────┘
```

Si el CTG no matchea ninguna afectación, el estado es **"Grano libre"** y se registra igual como `HUERFANO` para la bandeja de conciliación. Nunca se rechaza un camión por un problema de nuestro sistema.

Al confirmar: se crea el `MovimientoGrano`, se actualiza la afectación, se pide el upload de la certificación electrónica y se notifica a productor y admin.

**Posiciones** — tabla de todas las campañas afectadas en sus plantas: campaña, productor, comprometido, recibido, pendiente, afectado, semáforo. Ordenable y exportable.

**Liberaciones** — la pantalla candado. Muestra por campaña cuántas toneladas puede entregarle al productor. Si el grano está afectado, el botón está deshabilitado **y dice por qué**, con el número de convenio. El acopio no puede liberar por error ni alegar desconocimiento.

La liberación de excedente (lo que sobra de las toneladas comprometidas) es automática una vez cubierta la afectación. La liberación anticipada requiere autorización explícita de `ADMIN` y queda registrada con motivo y responsable.

**Certificaciones** — listado de comprobantes emitidos, con descarga y estado de conciliación.

### 9.6 Escalera de integración

No todos los acopios están al mismo nivel. El sistema soporta los cuatro desde el día uno y cada acopio declara el suyo en `nivelIntegracion`:

| Nivel | Cómo entra el dato | Para quién |
|---|---|---|
| `MANUAL` | Admin carga lo que llega por mail o WhatsApp | Acopio chico, primeras campañas |
| `PORTAL` | El acopio carga en nuestro sistema | El default, la mayoría |
| `API` | Nuestro sistema habla con el software del acopio | Acopios con sistema propio |
| `ARCA_DELEGADO` | Leemos los webservices de ARCA directamente | El objetivo |

**`ARCA_DELEGADO` es el nivel que nos libera.** Si el productor nos delega en ARCA los servicios de Carta de Porte y SISA con su clave fiscal, consultamos sus CTG sin depender de que nadie nos cuente nada.

Por eso: **la delegación de clave fiscal es requisito de entrada a la plataforma**, junto con la firma del contrato. Es un trámite corto para el productor y cambia por completo quién tiene el control de la información. Incluirlo en el onboarding del productor como paso obligatorio, con un tutorial paso a paso.

### 9.7 Motor de conciliación

Job programado, varias corridas por día:

```
1. Traer CTG nuevos del productor
     (API ARCA si hay delegación, o carga del acopio, o admin)

2. Por cada CTG:
     ¿existe afectación vigente para ese productor y cultivo?
        NO  → marcar HUERFANO → bandeja de revisión manual
        SÍ  → ¿destinoPlantaSisa coincide con la afectación?
                SÍ  → CONCILIADO, sumar a toneladasRecibidas
                NO  → DESVIO, alerta inmediata

3. Recalcular estado y semáforo de cada afectación

4. Notificar: productor, acopio, admin
     (al inversor solo cambia el bloque de custodia, sin alerta)
```

**Semáforo por afectación:**

- 🟢 `VERDE` — todo el grano fue al destino comprometido
- 🟡 `AMARILLO` — hay CTG sin conciliar hace más de 48 hs, o merma por encima del rango esperado
- 🔴 `ROJO` — hay grano con destino distinto al comprometido

El rojo se prende **mientras el camión está en la ruta**, no tres meses después. Ese es el valor operativo real del módulo: convertir el default en un evento detectable en tiempo real en lugar de una sorpresa en la liquidación.

**Bandeja de conciliación** (`/admin/conciliacion`): cola de trabajo con desvíos y huérfanos, cada uno con acciones — asignar a campaña, marcar como grano libre, escalar a disputa, contactar al productor.

### 9.8 Qué ve el inversor

Nada crudo. Un bloque acotado en la ficha de campaña y en el detalle de tenencia:

```
Custodia
Acopio San Martín SRL · Pergamino, BA
SISA activo · verificado 12/09/2026

Entregado    204 / 300 tn   ████████░░  68%
Última recepción: hace 2 días
Estado: 🟢 sin desvíos
```

Sin CTG, sin CUIT, sin tablas de movimientos. Solo la respuesta a la pregunta que se está haciendo: *¿mi grano está donde dijeron que iba a estar?*

En `AMARILLO` el copy es neutro y factual: *"Hay entregas pendientes de conciliar."* En `ROJO` no se muestra un semáforo al inversor: se dispara el protocolo de disputa y la comunicación la maneja `ADMIN` con un mensaje redactado, no un widget. Un cartel rojo automático en la ficha de una campaña es un incendio comercial y legal.

### 9.9 Componentes nuevos

| Componente | Qué hace |
|---|---|
| `PantallaRecepcion` | Resolución de CTG + carga de pesada. Optimizada para tablet. |
| `ResolucionCtg` | Input con escaneo QR, resuelve y muestra el estado del grano. |
| `TablaPosiciones` | Afectaciones por planta con semáforo. |
| `PanelLiberacion` | Cálculo de liberable y candado con motivo. |
| `SemaforoAfectacion` | Chip de estado con tooltip explicativo. |
| `BloqueCustodia` | El resumen para el inversor. |
| `BandejaConciliacion` | Cola de desvíos y huérfanos con acciones. |
| `MapaRedAcopios` | Plantas aliadas sobre mapa, para admin y landing. |
| `VerificadorSisa` | Consulta y cachea el estado SISA de un CUIT. |

### 9.10 Reglas duras

Estas van al backend como validaciones, no al front como avisos:

1. Una campaña **no puede pasar a `ABIERTA`** sin afectación creada, acopio con convenio firmado y SISA en estado 1 o 2.
2. El acopio **no puede liberar** grano afectado sin autorización de `ADMIN`.
3. `toneladasLiberadas` nunca puede superar `toneladasRecibidas`.
4. Un `MovimientoGrano` con `estadoConciliacion = 'DESVIO'` **bloquea la liquidación** de la campaña hasta resolverse.
5. El estado SISA del acopio se reverifica antes de cada publicación de campaña y semanalmente. Si cae a 3 o 4, las campañas activas quedan marcadas y no se abren nuevas con esa planta.
6. Todo cambio sobre una afectación queda en audit log con usuario, timestamp y valor anterior.

---

## 10. Componentes a construir

Todos en `src/components/campanas/`, tipados, con Storybook si el proyecto ya lo tiene.

| Componente | Qué hace |
|---|---|
| `MapaLote` | Leaflet + capa satelital. Modos: `ver`, `dibujar`, `editar`. Import KML/SHP. |
| `MiniaturaLote` | Render estático del polígono sobre satélite para las cards. Cachear. |
| `SelectorModoTokenizacion` | Las dos tarjetas + slider de rinde. |
| `CalculadoraCotizacion` | Referencia → descuento → precio → recaudación → tasa implícita. |
| `GraficoPizarra` | Serie de precios con líneas de referencia anotadas. |
| `GraficoClima` | Barras de precipitación real vs. histórica, superpuestas. |
| `GraficoNdvi` | Curva del lote vs. curva típica del cultivo. |
| `FichaSuelo` | Grilla de parámetros con fuente y rango de referencia. |
| `SimuladorRetorno` | Sliders + resultado en vivo + punto de equilibrio. |
| `BarraFondeo` | Progreso, con marcas de mínimo viable y objetivo. |
| `CardCampana` | La card del marketplace. |
| `PanelCompra` | El sticky de la derecha. |
| `SheetCompra` | El flujo de 3 pasos. |
| `TimelineAvance` | Hitos con foto y nota. |
| `BadgeGarantias` | Íconos de cobertura con tooltip. |
| `BadgeModo` | `FIJO` / `PORCENTUAL`, siempre visible. |
| `EstadoCampana` | Chip de estado con su color. |
| `TablaTenencias` | Portfolio. |

---

## 11. Datos externos

Todo detrás de un `DatosExternosService` con caché en base. **Nunca pegarle a una API externa desde el navegador**: el front consume siempre endpoints propios.

| Dato | Fuente candidata | Notas |
|---|---|---|
| Clima histórico y pronóstico | Open-Meteo | Gratis, sin API key. Archive API para histórico. |
| Suelo | SoilGrids (ISRIC) | REST, global. Complementar con cartas de suelo del INTA donde haya. |
| NDVI | Copernicus / Sentinel-2 | Requiere cuenta. Para el MVP, mockear con una curva realista. |
| Precio de pizarra | Cámara Arbitral de Cereales de Rosario | Verificar si hay API; si no, carga manual diaria por `ADMIN`. |
| Futuros | MATBA ROFEX | Verificar acceso y condiciones. |

**Cachear agresivamente.** El clima histórico de un lote cambia una vez al mes. El suelo no cambia nunca. Solo la pizarra y el pronóstico necesitan refresco diario.

**Fallback obligatorio:** si un dato externo no está disponible, la sección se muestra como no disponible con su motivo. Nunca un gráfico vacío sin explicación, y nunca un dato inventado.

---

## 12. Estados de la interfaz

**Carga:** skeletons con la forma del contenido real. La ficha de campaña carga por secciones: mapa y panel de compra primero, los gráficos después.

**Vacío:** cada pantalla vacía propone la acción siguiente.
- Sin campos → *"Cargá tu primer campo para empezar"* + botón
- Sin campañas → *"Creá una campaña sobre un campo existente"*
- Portfolio vacío → *"Todavía no invertiste"* + link al marketplace

**Error:** decir qué pasó y qué hacer. Sin disculpas, sin vaguedad. *"No pudimos cargar el clima de este lote. Reintentar."*

**Cierre de fondeo:** cuando quedan menos de 48 horas, la card y la ficha muestran countdown en vivo.

**Sobreventa:** si mientras el inversor completa la compra se agotan los tokens, avisar en el mismo sheet con la cantidad todavía disponible y opción de ajustar. Nunca fallar después de confirmar.

---

## 13. Orden de construcción

**Sprint 1 — Cimientos**
Modelo de datos y migraciones. Roles y guards. Shell con switch de contexto. `MockLedgerService`. Seed con 3 campos, 5 campañas en estados distintos, 2 inversores.

**Sprint 2 — El productor carga**
`MapaLote` completo con dibujo e import. Wizard de campo. Wizard de campaña pasos 1 y 2. `SelectorModoTokenizacion` funcionando con el slider de rinde.

**Sprint 3 — La oferta**
`CalculadoraCotizacion`. Pasos 3 y 4 del wizard. Vista previa. Cola de revisión de `ADMIN`. Publicación al marketplace.

**Sprint 4 — El inversor compra**
Marketplace con filtros. `CardCampana`. Ficha de campaña con mapa y panel sticky. `SheetCompra` con reserva y TTL. Portfolio básico.

**Sprint 5 — Custodia y acopio**
Entidades `Acopio`, `Planta`, `AfectacionGrano`, `MovimientoGrano`. Portal del acopio con Recepción, Posiciones y Liberaciones. Motor de conciliación en modo `PORTAL`. Semáforo. `BloqueCustodia` en la ficha del inversor. Bandeja de conciliación de `ADMIN`.

**Sprint 6 — Los datos**
`DatosExternosService`. Clima y suelo reales. Gráficos de clima, pizarra y NDVI. `SimuladorRetorno`.

**Sprint 7 — El durante**
`TimelineAvance`. Feed de novedades. Valorización de portfolio. Panel de inversores del productor.

**Si es para una demo con tiempo corto:** sprints 1, 2 y 4, con datos externos mockeados y la cotización fija. Eso ya cuenta la historia completa de punta a punta.

---

## 14. Datos de prueba

El seed tiene que alcanzar para demostrar sin tocar nada:

- Campañas en **todos** los estados, no solo `ABIERTA`.
- Al menos una `PORCENTUAL` y una `FIJO`, para poder contrastarlas en vivo.
- Una campaña al 95% de fondeo, para mostrar la urgencia.
- Una campaña con historial de rinde malo, para mostrar que el scoring y el precio reaccionan.
- Una campaña `EN_CURSO` con NDVI cayendo, para mostrar el monitoreo.
- Una `LIQUIDADA` con resultado positivo y otra con resultado por debajo de lo estimado. **Mostrar un caso que salió peor de lo esperado da más credibilidad que mostrar solo éxitos.**

Del lado de acopio:

- Dos acopios aliados con planta, uno en `PORTAL` y otro en `MANUAL`.
- Una afectación en 🟢, una en 🟡 con CTG sin conciliar, y una en 🔴 con desvío de destino, para poder mostrar la bandeja de conciliación funcionando.
- Al menos un `MovimientoGrano` huérfano.

Polígonos reales de la zona núcleo (Pergamino, Marcos Juárez, Río Cuarto) para que el satélite muestre campo de verdad.

---

## 15. Decisiones abiertas

- [ ] ¿El inversor puede vender su tenencia antes de la cosecha? Si sí, hace falta una pantalla de mercado secundario. **Recomendación: fuera del MVP**, pero dejar `Tenencia.estado` preparado.
- [ ] ¿Compra mínima? Sugerido: 1 tonelada. Bajar la barrera de entrada todo lo posible.
- [ ] ¿Qué pasa si el fondeo no llega al objetivo? Definir mínimo viable y devolución automática.
- [ ] ¿El productor puede cancelar una campaña ya fondeada? Con qué penalidad.
- [ ] ¿Los inversores ven el nombre real del productor antes de comprar, o después?
- [ ] Moneda de la interfaz: ¿todo en USD, o USD con equivalente en pesos al lado?
- [ ] ¿Una campaña puede afectarse a más de un acopio? (campos grandes con dos destinos habituales)
- [ ] ¿Quién paga el almacenaje del grano afectado, y se descuenta de la liquidación?
- [ ] Tolerancia de merma aceptada antes de que el semáforo pase a 🟡.

---

## 16. Lo que no hay que perder de vista

El riesgo del módulo no es técnico. Es que **el inversor tiene que confiar en algo que no puede tocar, durante seis meses, a miles de kilómetros.**

Cada decisión de interfaz se evalúa contra esa pregunta: *¿esto hace que alguien que nunca pisó un campo entienda qué está comprando y qué puede salir mal?*

Tres consecuencias prácticas:

1. **Los datos externos no son un adorno.** El clima, el suelo y el NDVI son la prueba de que el activo existe y está vivo. Son la función central, no el "nice to have" del sprint 5.
2. **El timeline de avance es retención.** Entre la compra y la cosecha no pasa nada; sin el feed, el inversor se olvida de que existís.
3. **Mostrar el riesgo vende más que esconderlo.** El simulador tiene que poder dar rojo. La campaña liquidada por debajo de lo estimado tiene que estar en el catálogo. Un producto financiero que solo muestra escenarios buenos no genera confianza, genera sospecha.