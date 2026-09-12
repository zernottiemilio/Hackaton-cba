#!/usr/bin/env bash
# Prepara el escenario de la demo contra el backend (Railway, LEDGER_IMPL=solana).
#
# Deja dos campañas de Juan, ambas create_campaign REAL en devnet:
#   A) "abierta": venta larga. En vivo, Carlos invierte y Juan cobra la siembra.
#   B) "respaldo": venta 2 min / liquidación 3 min, ya comprada por Carlos y con
#      la siembra cobrada por Juan. A los 3 minutos de correr el script queda
#      lista para que el admin liquide y Carlos cobre, sin esperar nada en vivo.
#
# Correrlo 5 minutos antes de subir al escenario. Uso:
#   scripts/demo/preparar-demo.sh            # prod
#   API=http://localhost:3000/api/v1 scripts/demo/preparar-demo.sh
set -euo pipefail
API=${API:-https://backend-production-c6cdb.up.railway.app/api/v1}
PASS=${DEMO_PASSWORD:-agrofacil123}

login() {
  curl -s -m 20 -X POST "$API/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | jq -r '.accessToken // empty'
}
# +N minutos en ISO UTC. macOS (-v) y GNU (-d).
iso() { date -u -v+"$1"M '+%Y-%m-%dT%H:%M:%S.000Z' 2>/dev/null || date -u -d "+$1 min" '+%Y-%m-%dT%H:%M:%S.000Z'; }
explorer() { echo "https://explorer.solana.com/tx/$1?cluster=devnet"; }

TJ=$(login juan@productor.demo);    [ -n "$TJ" ] || { echo "✗ login juan"; exit 1; }
TC=$(login carlos@inversor.demo);   [ -n "$TC" ] || { echo "✗ login carlos"; exit 1; }
TA=$(login admin@tokenizadas.demo); [ -n "$TA" ] || { echo "✗ login admin"; exit 1; }

# Establecimientos y cultivos del seed.
ALAMOS=00000000-1000-0000-0000-000000000002
BOSCO=00000000-1000-0000-0000-000000000003
MAIZ=3df95f0d-daaa-4fc7-95fa-ac46b7474a1b
TRIGO=d4e0304b-7879-4a7e-9593-ce9c0a10b874

# Crea + envía a revisión + aprueba. Imprime el id en stdout.
crear_aprobada() {
  local nombre=$1 campo=$2 cultivo=$3 ha=$4 rinde=$5 tnFijas=$6 ref=$7 mCierre=$8 mLiq=$9 minimas=${10}
  local body crear id aprob tx
  body=$(cat <<EOF
{"campaniaNueva":{"nombre":"$nombre","establecimientoId":"$campo","cultivoId":"$cultivo","cicloAgricola":"2026/27","hectareasAfectadas":$ha,"fechaSiembraEstimada":"2026-10-15","fechaCosechaEstimada":"2027-04-20","rindeEstimadoTnHa":$rinde},
 "modo":"fijo","toneladasFijas":$tnFijas,"fuentePrecio":"pizarra_rosario","precioReferenciaUsdTn":$ref,"descuentoPct":5,"precioDinamico":false,
 "fondeoDesde":"$(iso 0)","fondeoHasta":"$(iso "$mCierre")","fechaLiquidacionEstimada":"$(iso "$mLiq")","toneladasMinimas":$minimas,
 "tieneSeguroGranizo":true,"tieneSeguroParametrico":false,"tieneAvalSgr":false,"sobrecolateralPct":0}
EOF
)
  crear=$(curl -s -m 30 -X POST "$API/tokenizadas" -H "authorization: Bearer $TJ" -H 'content-type: application/json' -d "$body")
  id=$(echo "$crear" | jq -r '.id // empty')
  [ -n "$id" ] || { echo "✗ crear falló: $nombre → $(echo "$crear" | jq -c '.message // .')" >&2; return 1; }
  curl -s -m 30 -X POST "$API/tokenizadas/$id/enviar-revision" -H "authorization: Bearer $TJ" >/dev/null
  aprob=$(curl -s -m 120 -X POST "$API/tokenizadas/admin/$id/revisar" -H "authorization: Bearer $TA" -H 'content-type: application/json' -d '{"decision":"aprobar"}')
  tx=$(echo "$aprob" | jq -r '.publicacion.txSignature // empty')
  [ -n "$tx" ] || { echo "✗ aprobar falló: $nombre → $(echo "$aprob" | jq -c '.message // .')" >&2; return 1; }
  echo "✓ $nombre  id=$id" >&2
  echo "    create_campaign: $(explorer "$tx")" >&2
  echo "$id"
}

echo "── A) Campaña ABIERTA para invertir en vivo (venta 3 h)"
A=$(crear_aprobada "Los Álamos · Maíz 2026/27" $ALAMOS $MAIZ 380 8 500 190 180 190 100)

echo "── B) Campaña RESPALDO lista para liquidar (venta 2 min / liquidación 3 min)"
B=$(crear_aprobada "Don Bosco · Trigo 2026/27" $BOSCO $TRIGO 165 4 200 230 2 3 50)

echo "── Carlos compra 60 tn de B"
WALLET=$(curl -s -m 60 -X POST "$API/tokenizadas/wallet/conectar" -H "authorization: Bearer $TC" | jq -r '.address // empty')
[ -n "$WALLET" ] || { echo "✗ wallet de Carlos"; exit 1; }
reserva=$(curl -s -m 60 -X POST "$API/tokenizadas/reservas" -H "authorization: Bearer $TC" -H 'content-type: application/json' \
  -d "{\"tokenizacionId\":\"$B\",\"cantidad\":60,\"inversorWallet\":\"$WALLET\"}")
RID=$(echo "$reserva" | jq -r '.reservaId // empty')
[ -n "$RID" ] || { echo "✗ reserva: $(echo "$reserva" | jq -c '.message // .')"; exit 1; }
compra=$(curl -s -m 120 -X POST "$API/tokenizadas/reservas/confirmar" -H "authorization: Bearer $TC" -H 'content-type: application/json' -d "{\"reservaId\":\"$RID\"}")
txC=$(echo "$compra" | jq -r '.txSignature // empty')
[ -n "$txC" ] || { echo "✗ confirmar: $(echo "$compra" | jq -c '.message // .')"; exit 1; }
echo "    invest: $(explorer "$txC")"

echo "── Juan cobra la siembra de B"
lib=$(curl -s -m 120 -X POST "$API/tokenizadas/$B/liberar-fondos" -H "authorization: Bearer $TJ")
txL=$(echo "$lib" | jq -r '.txSignature // empty')
[ -n "$txL" ] || { echo "✗ liberar-fondos: $(echo "$lib" | jq -c '.message // .')"; exit 1; }
echo "    release_funds: $(explorer "$txL")"

echo
echo "Listo. En el escenario:"
echo "  1. Carlos invierte en A y Juan cobra la siembra (instantáneo)."
echo "  2. Admin liquida B desde /liquidacion a partir de las $(date -v+3M '+%H:%M' 2>/dev/null || date -d '+3 min' '+%H:%M') (hora local)."
echo "  3. Carlos cobra B desde su portfolio."
