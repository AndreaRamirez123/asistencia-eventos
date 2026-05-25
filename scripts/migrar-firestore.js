import admin from 'firebase-admin'
import { createRequire } from 'module'
import { join } from 'path'
import { homedir } from 'os'

const require = createRequire(import.meta.url)

const KEY_PATH = join(
  homedir(),
  'Downloads',
  'desarrollo-investigaciones-firebase-adminsdk-fbsvc-8c5057d0e5.json',
)

const COLECCIONES = [
  'clientes',
  'eventoAsistentes',
  'eventoCalificaciones',
  'eventoEmpresas',
  'eventoEstaciones',
  'eventoEventos',
  'eventoTriviaResultados',
  'eventoTrivias',
  'eventoUsuarios',
  'eventoVisitas',
]

const PROJECT_ID = 'desarrollo-investigaciones'
const DB_DESTINO = 'eventos-divergentes'

async function migrarColeccion(origen, destino, nombreCol) {
  const snap = await origen.collection(nombreCol).get()
  if (snap.empty) {
    console.log(`  ⚪ ${nombreCol}: vacía, se omite`)
    return 0
  }

  const LOTE_MAX = 400
  let total = 0
  let lote = destino.batch()
  let enLote = 0

  for (const docSnap of snap.docs) {
    lote.set(destino.collection(nombreCol).doc(docSnap.id), docSnap.data())
    enLote++
    total++
    if (enLote >= LOTE_MAX) {
      await lote.commit()
      lote = destino.batch()
      enLote = 0
    }
  }

  if (enLote > 0) await lote.commit()
  console.log(`  ✅ ${nombreCol}: ${total} documentos migrados`)
  return total
}

async function main() {
  const serviceAccount = require(KEY_PATH)

  const appOrigen = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID },
    'origen',
  )
  const appDestino = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID },
    'destino',
  )

  const dbOrigen = admin.firestore(appOrigen)
  dbOrigen.settings({ databaseId: '(default)' })

  const dbDestino = admin.firestore(appDestino)
  dbDestino.settings({ databaseId: DB_DESTINO })

  console.log(`\n🚀 Migrando: (default) → ${DB_DESTINO}\n`)

  let total = 0
  for (const col of COLECCIONES) {
    total += await migrarColeccion(dbOrigen, dbDestino, col)
  }

  console.log(`\n✅ Listo. ${total} documentos copiados.`)
  console.log('   Los datos originales en "default" NO fueron eliminados.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
