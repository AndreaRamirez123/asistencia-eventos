# Propuesta de costos — App de registro de asistentes

Plataforma web (marca blanca) | Stack: Firebase serverless | TC: 1 USD = $4.000 COP | Sin IVA

---

## 1. Supuestos del modelo

| Concepto | Valor | Notas |
|---|---|---|
| Lecturas Firestore | $0,06 USD/100k | Free: 50k/día |
| Escrituras Firestore | $0,18 USD/100k | Free: 20k/día |
| Almacenamiento Firestore | $0,18 USD/GB/mes | Free: 1 GB |
| Hosting transferencia | $0,15 USD/GB | Free: 10 GB/mes |
| Auth usuario adicional | $0,0055 USD/MAU | Free: 50k MAU/mes |
| Lecturas por asistente | 20 | Login + consulta + dashboard + listas |
| Escrituras por asistente | 5 | Registro + checkin + encuesta + calificación |
| Bundle web | 5 MB | React + Vite + ZXing + libs |
| Tarifa dev | $100.000 COP/h | Mid-senior Colombia |
| Cloud Functions | $5 USD/mes | $0 si no se usan |
| Egress multi-región | $2 USD/mes | Buffer |
| Buffer contingencia | 40% | Sobre infra |
| Setup inicial | 12 h | One-time |
| Capacitación | 3 h | One-time |
| Mantenimiento mensual | 7 h | Base |
| Soporte por evento | 3 h | Adicional |
| IA / OCR / QR / scan | $0 | Todo local en navegador |

---

## 2. Costo de operación por escenario (mensual)

| | Piloto | Pequeño | Mediano | Grande | Recurrente |
|---|---|---|---|---|---|
| Eventos/mes | 1 | 1 | 1 | 1 | 4 |
| Asistentes/evento | 500 | 2.000 | 5.000 | 15.000 | 5.000 |
| Asistentes totales/mes | 500 | 2.000 | 5.000 | 15.000 | 20.000 |
| Lecturas Firestore | 10.000 | 40.000 | 100.000 | 300.000 | 400.000 |
| Lecturas cobradas | — | — | 50.000 | 250.000 | 200.000 |
| Escrituras Firestore | 2.500 | 10.000 | 25.000 | 75.000 | 100.000 |
| Escrituras cobradas | — | — | 5.000 | 55.000 | 20.000 |
| Hosting GB transferidos | 2,4 | 9,8 | 24,4 | 73,2 | 97,7 |
| Hosting GB cobrados | 0 | 0 | 14,4 | 63,2 | 87,7 |
| Almacenamiento Firestore (GB) | 0,001 | 0,004 | 0,010 | 0,029 | 0,038 |
| MAU | 500 | 2.000 | 5.000 | 15.000 | 20.000 |
| Costo Firestore (USD) | — | — | $0,04 | $0,25 | $0,16 |
| Costo Hosting (USD) | — | — | $2,16 | $9,49 | $13,15 |
| Cloud Functions (USD) | $5 | $5 | $5 | $5 | $5 |
| Egress (USD) | $2 | $2 | $2 | $2 | $2 |
| IA / procesamiento | — | — | — | — | — |
| Subtotal infra (USD) | $7,00 | $7,00 | $9,20 | $16,74 | $20,30 |
| Buffer 40% (USD) | $2,80 | $2,80 | $3,68 | $6,69 | $8,12 |
| **Infra total (USD)** | **$9,80** | **$9,80** | **$12,88** | **$23,43** | **$28,43** |
| **Infra total (COP)** | **$39.200** | **$39.200** | **$51.526** | **$93.718** | **$113.705** |
| Total horas humanas/mes | 5 | 7 | 10 | 15 | 24 |
| **Costo humano (COP)** | **$500.000** | **$700.000** | **$1.000.000** | **$1.500.000** | **$2.400.000** |
| **TOTAL mensual (COP)** | **$539.200** | **$739.200** | **$1.051.526** | **$1.593.718** | **$2.513.705** |
| **Setup one-time (COP)** | $1.500.000 | $1.500.000 | $1.500.000 | $1.500.000 | $1.500.000 |

> Cifras validables en Google Cloud Pricing Calculator (cloud.google.com/products/calculator) usando los valores de Firestore, Hosting y Auth de la tabla anterior.

---

## 3. Pricing al cliente y margen

| | Plan Básico | Plan Profesional | Plan Enterprise | Plan Recurrente |
|---|---|---|---|---|
| Cubre | 1 evento × 2.000 | 1 evento × 5.000 | 1 evento × 15.000 | 4 eventos × 5.000 |
| Costo total mensual | $739.200 | $1.051.526 | $1.593.718 | $2.513.705 |
| Costo setup | $1.500.000 | $1.500.000 | $1.500.000 | $1.500.000 |
| **Setup al cliente** | $1.500.000 | $2.000.000 | $3.000.000 | $2.500.000 |
| **Cuota mensual al cliente** | **$1.200.000** | **$1.800.000** | **$2.800.000** | **$3.800.000** |
| Margen mensual COP | $460.800 | $748.474 | $1.206.282 | $1.286.295 |
| **Margen mensual %** | **38,4%** | **41,6%** | **43,1%** | **33,8%** |
| Ingreso anual (setup + 12) | $15.900.000 | $23.600.000 | $36.600.000 | $48.100.000 |
| Costo anual (setup + 12) | $10.370.400 | $14.118.315 | $20.624.614 | $31.664.458 |
| Margen anual COP | $5.529.600 | $9.481.685 | $15.975.386 | $16.435.542 |
| **Margen anual %** | **34,8%** | **40,2%** | **43,6%** | **34,2%** |

---

## 4. Notas

- Costo dominante = tiempo humano (>90%). Infra Firebase es <8% del total.
- Validar 20 reads / 5 writes por asistente con evento real antes de firmar.
- Eventos fuera del rango del plan: fee adicional aparte.
- Cloud Functions, integraciones CRM, correos masivos, hardware (tablets, pendones) = cotización aparte.
- SLA estricto durante eventos sube el tiempo humano comprometido.
