# Speech de la demo · Harvest.fi

Guion para presentar el flujo completo en vivo, con foco en explicar **qué pasa en Solana** en cada click. Tiempo total: 5 a 6 minutos.

## Preparación (5 min antes de subir)

1. Correr `scripts/demo/preparar-demo.sh`. Deja una campaña de respaldo ya fondeada y liquidable.
2. Navegador A: sesión de **Juan** (`juan@productor.demo`), en *Mis emisiones*.
3. Navegador B: sesión de **Carlos** (`carlos@inversor.demo`), en *Invertir*.
4. Tener abierto Solana Explorer en devnet en una tercera pestaña.

## Vocabulario mínimo (para no trabarse)

| Palabra | Qué es, en una frase |
|---|---|
| **Programa** | El contrato inteligente. En Solana se llama "programa". El nuestro tiene 5 instrucciones: crear campaña, invertir, liberar fondos, liquidar, redimir. |
| **Token HRV** | Un token por tonelada de la cosecha. Se crea (se "mintea") cuando el inversor compra. |
| **Mint** | La "fábrica" del token de esa campaña. Cada campaña tiene la suya. |
| **Vault** | Una cuenta de USDC que controla el programa, no una persona. Ahí entra la plata del inversor. |
| **USDC** | Dólar digital. En devnet es de prueba, en mainnet es dólar de verdad. |
| **PDA** | Una cuenta cuya dirección la deriva el programa a partir de datos (productor + id de campaña). Nadie tiene la clave privada: solo el programa puede mover lo que hay adentro. Es lo que hace que el vault sea un escrow de verdad. |
| **Wallet custodial** | La plataforma guarda la clave del usuario cifrada y firma por él. Como una cuenta bancaria: el usuario no ve la clave. Esto es lo que permite que un productor sin conocimientos cripto use la app. |
| **Devnet** | Red de prueba de Solana. Mismo código que la red principal, plata de mentira. |
| **Signature / tx** | El comprobante de cada operación. Es público, cualquiera lo verifica en el explorer. |

## Guion

### 0. Apertura (30 s)

> Un productor necesita plata en la siembra y la cobra en la cosecha, seis meses después. Hoy ese financiamiento pasa por el acopio, el banco o el canje, con tasas altas y sin transparencia. Harvest.fi convierte la cosecha futura en tokens: un token es una tonelada. El inversor compra hoy con descuento, el productor cobra hoy, y cuando llega el grano el inversor cobra al precio real. Todo pasa en Solana, y cada paso lo van a poder ver en el explorer.

### 1. Juan publica la campaña (Navegador A · 45 s)

Click en **⚡ Publicar campaña demo** → **Aprobar**.

> Lo que acaba de pasar en la cadena es la instrucción `create_campaign`. El programa creó tres cosas: la cuenta de la campaña con las reglas (100 toneladas, precio, hasta cuándo se vende, desde cuándo se liquida), el *mint* del token de esta cosecha, y el *vault*: una cuenta de USDC que controla el programa, no Juan ni nosotros.

Mostrar el link "Ver tx" → explorer.

> Esto es el comprobante. Está en devnet, la red de prueba, con el mismo código que la red principal.

Si preguntan por la aprobación: *"En producción un admin de la plataforma revisa la campaña antes de publicarla. Para la demo la aprobamos en el mismo click."*

### 2. Carlos compra (Navegador B · 60 s)

Refrescar *Invertir* → aparece la campaña con el productor y su reputación. Click en la fila → cantidad **20** → **Continuar** → **Aprobar**.

> Miren la columna Productor: Juan tiene rating 5 y campañas liquidadas. Esa reputación no la escribió nadie: la calcula el backend con lo que pasó en la cadena.

Cuando confirma:

> Esto es la instrucción `invest`. En una sola transacción atómica pasan dos cosas: salen los USDC de la wallet de Carlos al *vault*, y el programa le acuña 20 tokens HRV. Si una de las dos falla, no pasa ninguna. Además, la plataforma cobra una comisión del 1,5 %, que también va por la cadena a nuestra tesorería.

Mostrar en el explorer el vault con el saldo, o el portfolio de Carlos con sus 20 tokens y el link a la tx.

### 3. Juan cobra la siembra (Navegador A · 45 s)

Volver a *Mis emisiones* → la campaña muestra 20 / 100 tn vendidas → **Cobrar siembra** → **Aprobar**.

> Esta es la instrucción `release_funds`. La campaña fijó un mínimo de toneladas; como se alcanzó, el programa deja que el vault se vacíe hacia la wallet de Juan. Antes del mínimo, el programa lo rechaza. No hay un botón nuestro que pueda saltear esa regla: está en el contrato.

Abrir la wallet de Juan (arriba a la derecha): el saldo subió, y en *Actividad* está la tx del cobro y la del fee.

> Juan ya tiene la plata de la siembra. Hoy. Sin banco.

### 4. Llega la cosecha: el acopio liquida (Admin · 45 s)

Cambiar a la sesión de admin (o usar la campaña de respaldo si la nueva todavía no llegó al minuto 12) → *Liquidación* → cargar toneladas entregadas y precio → **Liquidar** → **Aprobar**.

> Pasaron seis meses. El acopio recibió el grano y paga el precio real de pizarra. Esta es la instrucción `settle`: el acopio deposita USDC en el vault y el programa calcula cuánto vale cada token. Fíjense que el programa no deja liquidar antes de la fecha de cosecha que se fijó al crear: la regla está en la cadena.

### 5. Carlos cobra (Navegador B · 30 s)

*Portfolio* → **Cobrar** → **Aprobar**.

> Última instrucción: `redeem`. El programa quema los 20 tokens de Carlos y le transfiere su parte del vault. Compró con descuento, cobra a precio real: esa diferencia es su ganancia. Y todo el recorrido, de la siembra a la cosecha, quedó auditado en la cadena.

### Cierre (20 s)

> Cinco instrucciones, cinco transacciones que cualquiera puede verificar. El productor financia su siembra sin intermediarios, el inversor accede a un activo real con retorno claro, y la plataforma cobra una comisión chica por unir a los dos. Eso es Harvest.fi.

## Preguntas probables

- **¿Por qué Solana?** Transacciones de menos de un segundo y de una fracción de centavo. Un productor no puede pagar diez dólares de gas por cobrar su siembra.
- **¿Y si no se llega al mínimo?** Hoy la plata queda en el vault y el productor no puede cobrar. El siguiente paso es la instrucción de devolución al inversor.
- **¿Quién custodia las claves?** La plataforma, cifradas. Es una decisión de producto: el productor no quiere saber qué es una seed phrase. Más adelante se puede ofrecer conectar una wallet propia.
- **¿Es mainnet?** Es devnet: mismo código, plata de prueba. Pasar a mainnet es cambiar una variable y el USDC real.
- **¿Y si el productor no entrega?** Las garantías (seguro de granizo, aval SGR) y la reputación on-chain. Un productor que no cumple queda marcado en su historial para siempre.
