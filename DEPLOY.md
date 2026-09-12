# Deploy AgroFácil a Railway

Guía paso a paso para deployar el monorepo (backend NestJS + frontend Vite + Postgres) en [Railway](https://railway.com).

Railway detecta el monorepo automáticamente y nos permite crear **3 servicios** en el mismo proyecto:

```
agrofacil/
├── postgres       ← plugin de Railway
├── backend        ← NestJS, root dir = backend/
└── frontend       ← Vite SPA estático, root dir = frontend/
```

---

## 1. Crear proyecto

1. Entrá a https://railway.com → `New Project`.
2. Elegí **Deploy from GitHub repo** → autorizá el repo `M-formoso/agrofacil`.
3. Railway va a crear un primer servicio automáticamente. **Borralo** (lo armamos manual abajo para tener control sobre el root dir de cada uno).

---

## 2. Agregar Postgres

1. Dentro del proyecto: `+ New` → `Database` → **PostgreSQL**.
2. Railway provisiona el plugin y expone automáticamente la variable `DATABASE_URL` para referenciarla desde otros servicios.
3. Verificá en `Variables` del servicio Postgres que existe `DATABASE_URL`.

---

## 3. Crear servicio backend

### 3.1 Crear el servicio

1. `+ New` → `GitHub Repo` → seleccioná `M-formoso/agrofacil`.
2. Una vez creado, abrí el servicio → `Settings`:
   - **Service name**: `backend`
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**` (opcional — para que solo redeploye cuando cambia esa carpeta)
3. **Build & Deploy** debe tomar lo que dice `backend/railway.toml`:
   - Build: `npm install --include=dev && npx prisma generate && npm run build`
   - Start: `npx prisma migrate deploy && npm run db:seed && node dist/main.js`
   - Healthcheck: `/api/v1/health`

### 3.2 Variables de entorno del backend

En `Variables` del servicio `backend`, agregá (los `${{ ... }}` son **referencias dinámicas** a otros servicios — la propia Railway las resuelve):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` |
| `JWT_SECRET` | un string aleatorio de 32+ caracteres (generá uno con `openssl rand -hex 32`) |
| `JWT_ACCESS_EXPIRES_IN` | `30m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `PORT` | Railway lo setea automáticamente — no la pongas |
| `CORS_ORIGIN` | `https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}` (la armás **después** de crear el frontend; ver paso 5) |
| `NODE_ENV` | `production` |
| `ANTHROPIC_API_KEY` | (opcional, para la fase de voz/foto) |
| `SUPERADMIN_EMAIL` | email con el que vas a loguearte al panel `/admin` |
| `SUPERADMIN_PASSWORD` | contraseña fuerte (guardala en un gestor) |
| `SUPERADMIN_NOMBRE` | tu nombre para mostrar (ej: `Mateo Formoso`) |
| `APP_PUBLIC_URL` | `https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}` — base para armar links de activación en emails |
| `RESEND_API_KEY` | API key generada en resend.com (`re_xxxxx`). Si está vacía los emails se loguean en vez de enviarse |
| `EMAIL_FROM` | Remitente. Ej: `AgroFácil <soporte@agrofacilar.com>`. Usar dominio verificado |
| `EMAIL_REPLY_TO` | A dónde llegan los "Responder". Ej: `soporte@agrofacilar.com` |

### 3.3 Generar dominio público

`Settings` → `Networking` → **Generate Domain** → Railway te da una URL tipo `agrofacil-backend-production.up.railway.app`. Guardala — la vas a usar en el frontend.

---

## 4. Crear servicio frontend

### 4.1 Crear el servicio

1. `+ New` → `GitHub Repo` → mismo repo `M-formoso/agrofacil`.
2. `Settings`:
   - **Service name**: `frontend`
   - **Root Directory**: `frontend`
   - **Watch Paths**: `frontend/**` (opcional)
3. Build & Deploy toma `frontend/railway.toml`:
   - Build: `npm ci && npm run build`
   - Start: `npm run start` (sirve `dist/` con `serve` en el `$PORT` de Railway)

### 4.2 Variables de entorno del frontend

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://${{ backend.RAILWAY_PUBLIC_DOMAIN }}/api/v1` |
| `PORT` | Railway lo setea — no la pongas |

> ⚠️ Las variables `VITE_*` se inyectan **en build time**. Si cambiás `VITE_API_URL` después, tenés que redeployar.

### 4.3 Generar dominio público

`Settings` → `Networking` → **Generate Domain** → te da `agrofacil-frontend-production.up.railway.app`.

---

## 5. Volver al backend y setear CORS_ORIGIN

Ahora que el frontend tiene dominio:

1. Backend → `Variables`.
2. `CORS_ORIGIN` = `https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}`
3. Railway redeploya el backend automáticamente.

---

## 6. Primera migración + seed

El backend corre **`npx prisma migrate deploy && npm run db:seed`** en cada start (definido en `backend/railway.toml`), así que tanto las migraciones como el seed se aplican solos en cada deploy.

El seed es **idempotente** (todo con `upsert`):
- Crea/actualiza el superadmin a partir de `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NOMBRE`. Si no están seteadas, salta este paso con un warning en los logs.
- Crea/actualiza la cuenta demo `demo@agrofacil.dev` / `agrofacil123`.
- Crea/actualiza el catálogo base de cultivos.

> 💡 Como es idempotente, podés cambiar la `SUPERADMIN_PASSWORD` en Variables y al próximo deploy se rotea sola.

### Si querés correr el seed manualmente contra Railway desde tu máquina
1. En el servicio Postgres → `Connect` → copiá la `DATABASE_PUBLIC_URL`.
2. En tu terminal local:
   ```bash
   cd backend
   DATABASE_URL="postgresql://...railway..." \
     SUPERADMIN_EMAIL="..." SUPERADMIN_PASSWORD="..." SUPERADMIN_NOMBRE="..." \
     npm run db:seed
   ```

---

## 7. Configurar Resend (envío de emails de invitación)

Las invitaciones que el superadmin manda desde el panel salen vía Resend. Hay que verificar el dominio `agrofacilar.com` una sola vez. Mientras tanto el código funciona en modo sandbox (`onboarding@resend.dev`), que solo deja mandar al email con el que te registraste en Resend.

### 7.1 Crear cuenta y obtener API key
1. Entrá a [resend.com](https://resend.com) → Sign up con `agrofacioficial@gmail.com`.
2. Una vez adentro: **API Keys** → **Create API Key** → name `agrofacil-prod`, permisos `Sending access` → copiar la key (empieza con `re_`).
3. Pegarla en Railway → servicio backend → Variables → `RESEND_API_KEY`.

### 7.2 Verificar el dominio `agrofacilar.com`
1. En Resend → **Domains** → **Add Domain** → `agrofacilar.com`.
2. Resend te muestra una lista de registros DNS que tenés que cargar donde compraste el dominio (NIC.ar, Namecheap, Cloudflare, etc.). Típicamente son:

| Tipo | Host / Name | Valor (te lo da Resend) |
|---|---|---|
| `MX` (prio 10) | `send.agrofacilar.com` | `feedback-smtp.<region>.amazonses.com` |
| `TXT` (SPF) | `send.agrofacilar.com` | `v=spf1 include:amazonses.com ~all` |
| `CNAME` (DKIM #1) | `resend._domainkey.agrofacilar.com` | `resend.<hash>.dkim.amazonses.com` |
| `CNAME` (DKIM #2) | `resend2._domainkey.agrofacilar.com` | `resend2.<hash>.dkim.amazonses.com` |
| `CNAME` (DKIM #3) | `resend3._domainkey.agrofacilar.com` | `resend3.<hash>.dkim.amazonses.com` |

> ⚠️ Los `<hash>` son específicos de tu cuenta — los copiás del dashboard de Resend, no los inventes.

3. Los registros se cargan en el **subdominio `send.agrofacilar.com`** (excepto los DKIM que van en `resend._domainkey.`), así que **tu MX principal para recibir emails en `soporte@agrofacilar.com` queda intacto**.
4. Una vez cargados, en Resend → **Verify DNS Records**. Tarda entre 5 minutos y unas horas.
5. Cuando aparezca el ✅ verde, en Railway cambiar `EMAIL_FROM` a `AgroFácil <soporte@agrofacilar.com>` (si no estaba ya) y redeployar.

### 7.3 (Opcional pero recomendado) Agregar DMARC

Cuando los DKIM estén verdes, agregá un registro más en tu DNS:

| Tipo | Host | Valor |
|---|---|---|
| `TXT` | `_dmarc.agrofacilar.com` | `v=DMARC1; p=none; rua=mailto:soporte@agrofacilar.com` |

Mejora la entregabilidad y te llegan reportes de quién intenta enviar emails diciendo ser de tu dominio.

### 7.4 Test rápido
Desde el panel admin: invitar a un usuario nuevo con un email cualquiera (gmail, hotmail). Debería llegarle el correo en ~1 minuto. Si no llega:
- Revisar **spam** primero.
- En Resend → **Emails** vas a ver el log de todos los envíos con su status (`delivered`, `bounced`, `complained`).
- En Railway logs del backend buscar `[EMAIL` para ver si lo está intentando enviar.

---

## 8. Verificar

1. Abrí `https://<frontend-domain>/` → deberías ver el login.
2. Loggeate con `demo@agrofacil.dev` / `agrofacil123`.
3. Verificá:
   - Backend: `curl https://<backend-domain>/api/v1/health` → `{"status":"ok",...}`
   - Frontend: navegación funciona, ⌘K abre command palette, los cards se ven.

---

## Variables de entorno — resumen

### Backend
```
DATABASE_URL          = ${{ Postgres.DATABASE_URL }}
JWT_SECRET            = <32+ chars random>
JWT_ACCESS_EXPIRES_IN = 30m
JWT_REFRESH_EXPIRES_IN= 7d
CORS_ORIGIN           = https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}
NODE_ENV              = production
ANTHROPIC_API_KEY     = (opcional)
```

### Frontend
```
VITE_API_URL = https://${{ backend.RAILWAY_PUBLIC_DOMAIN }}/api/v1
```

---

## Troubleshooting

### `prisma migrate deploy` falla con "no DATABASE_URL"
- Verificá que la variable está en el servicio backend, no solo en Postgres.
- Las refs `${{ Postgres.DATABASE_URL }}` se resuelven cuando ambos servicios están en el mismo proyecto.

### El backend levanta pero el frontend tira CORS errors
- Confirmá que `CORS_ORIGIN` en backend = la URL pública del frontend (con `https://` y SIN slash final).
- Después de cambiar `CORS_ORIGIN`, esperá que Railway redeploye (~1 min).

### El frontend muestra "Network Error" al hacer login
- Abrí DevTools → Network → ver a qué URL está pegando.
- Si pega a `http://localhost:3000` significa que `VITE_API_URL` no se inyectó en build → forzar **Redeploy** del frontend.

### Pino-pretty rompe en producción
- En prod no se usa (lo configuré para que solo se active si `NODE_ENV !== production`).
- Asegurate que la variable `NODE_ENV=production` esté seteada.

### Quiero pegarme directo a la DB
- Postgres → `Connect` → te da: psql command, connection string público, y la `DATABASE_URL` interna.
- Usá la pública desde fuera de Railway.

---

## Costos (estimado al cierre 2026)

Railway tier "Hobby" cubre proyectos pequeños:
- Postgres compartido: ~$5/mes
- Backend (idle most of the time): ~$5/mes
- Frontend estático: bajo demanda

Para un MVP con 5–10 productores de prueba, **alrededor de USD 10–15/mes**.

---

## Próximos pasos sugeridos

Una vez que el deploy esté verde:
1. Configurar **dominio custom** (ej. `app.agrofacil.com.ar`) en Settings → Networking → Custom Domain.
2. Activar **deploy automático** desde `main` (ya viene activo por defecto).
3. Crear ambiente **staging** desde otra rama (`develop`) — Railway soporta múltiples environments en el mismo proyecto.
4. Agregar `ANTHROPIC_API_KEY` cuando arranque la fase de carga por voz/foto.
