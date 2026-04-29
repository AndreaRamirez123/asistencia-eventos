# Costos de operación — App de registro y control de asistencia

## Contexto del proyecto

| Concepto | Detalle |
|---|---|
| Tipo de aplicación | Plataforma web de registro de asistentes (transaccional, eventos puntuales) |
| Patrón de carga | Picos altos durante el evento, mínimo entre eventos |
| Stack | Firebase (Firestore, Authentication, Hosting) — sin servidor propio |
| Procesamiento intensivo | En el navegador del usuario (QR, validación) |
| Región | Firebase multi-región (default: us-central) |
| Fuente de precios | Google Firebase Pricing Calculator (plan Blaze, abr 2026) |

---

## Costo mensual por escala de uso (USD)

Referencia base por asistente: ~3-5 escrituras + 10-20 lecturas Firestore.

| Escala mensual | Firestore | Hosting | Auth | Total USD/mes | Total COP/mes |
|---|---|---|---|---|---|
| Sin eventos (idle) | $0 | $0 | $0 | **$0** | **$0** |
| 1 evento ≤500 asistentes | $0 | $0 | $0 | **$0** | **$0** |
| 1 evento 2.000 asistentes | $0,11 | $0,30 | $0 | **$0,41** | **~$1.640** |
| 1 evento 5.000 asistentes | $0,28 | $0,75 | $0 | **$1,03** | **~$4.120** |
| 1 evento 15.000 asistentes | $0,84 | $2,25 | $0 | **$3,09** | **~$12.360** |
| 4 eventos × 5.000 asistentes | $1,12 | $3,00 | $0 | **$4,12** | **~$16.500** |

> Tipo de cambio referencia: 1 USD ≈ $4.000 COP.

### Detalle de pricing Firebase (oficial)

| Servicio | Free tier diario | Costo después del free tier |
|---|---|---|
| Firestore — lecturas | 50.000 / día | $0,06 USD por cada 100.000 |
| Firestore — escrituras | 20.000 / día | $0,18 USD por cada 100.000 |
| Firestore — almacenamiento | 1 GB | $0,18 USD por GB/mes |
| Hosting — transferencia | 10 GB / mes | $0,15 USD por GB |
| Authentication — usuarios activos | 50.000 / mes | $0,0055 USD por usuario adicional |

---

## Costos fijos

| Concepto | Costo |
|---|---|
| Certificado SSL | Incluido en Firebase Hosting |
| Backup mensual de base de datos | Incluido en Firestore (no genera costo extra) |

---

## Costos de IA y procesamiento

**$0 / mes**, sin importar el volumen de uso.

| Funcionalidad | Tecnología | Costo |
|---|---|---|
| Generación de QR | qrcode.js (local) | $0 |
| Escaneo de QR con cámara | ZXing (local) | $0 |
| OCR de cédula (deshabilitado actualmente) | Tesseract.js (local) | $0 |

> **No se usan APIs de pago** (OpenAI, Google Vision, AWS Rekognition, Claude). Todo el procesamiento corre en el navegador del usuario, así que no factura nada por uso.

---

## Costos de tiempo humano (carga interna)

Tarifa referencia: **$80.000 - $150.000 COP por hora dev** (mid-senior en Colombia).

| Concepto | Tiempo | Costo COP |
|---|---|---|
| Mantenimiento técnico mensual | 5-10 h | $400.000 - $1.500.000 |
| Setup inicial de cliente nuevo | 8-16 h | $640.000 - $2.400.000 |
| Capacitación al equipo del cliente | 2-4 h | $160.000 - $600.000 |

---

## Recomendación

Para un cliente con **1 evento mensual de hasta 5.000 asistentes**, el costo total de operación es de **~$4.000-5.000 COP/mes** en infraestructura, más el tiempo humano (mantenimiento + soporte) según el plan contratado.

Para eventos masivos (15.000+ asistentes en un solo evento), el costo de infraestructura para ESE mes sube a **~$12.000-15.000 COP**, sigue siendo despreciable comparado con plataformas tradicionales (Cloud SQL u otros backends always-on cuestan $2.000+ USD/mes solo en servidores).

### Por qué es tan económico

- Usamos **Firebase serverless**: solo se paga por uso real, no por máquinas always-on.
- El procesamiento de QR y validaciones corre en el **navegador del usuario**, no en nuestros servidores.
- No hay servidor backend dedicado.
- Auth, hosting y certificados SSL están en el plan gratuito de Firebase para nuestro volumen.

---

*Costos calculados con pricing oficial Google Firebase plan Blaze. Tipo de cambio referencial 1 USD = $4.000 COP. Sin IVA.*
