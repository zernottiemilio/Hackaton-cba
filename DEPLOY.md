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
   - Build: `npm ci && npx prisma generate && npm run build`
   - Start: `npx prisma migrate deploy && node dist/main.js`
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

El backend corre `npx prisma migrate deploy` en cada start (definido en `railway.toml`), así que las migraciones se aplican solas en el primer deploy.

**Para correr el seed** (cuenta + usuario demo + catálogo de cultivos):

### Opción A — desde tu máquina contra la DB de Railway
1. En el servicio Postgres → `Connect` → copiá la `DATABASE_PUBLIC_URL`.
2. En tu terminal local:
   ```bash
   cd backend
   DATABASE_URL="postgresql://...railway..." npm run db:seed
   ```

### Opción B — agregar el seed al startCommand del backend (una vez)
En `Settings` del backend, sobreescribí temporalmente el Start Command:
```
npx prisma migrate deploy && npm run db:seed && node dist/main.js
```
Después del primer deploy, volvelo a:
```
npx prisma migrate deploy && node dist/main.js
```

> El seed está hecho con `upsert`, así que correrlo más de una vez es seguro.

---

## 7. Verificar

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
