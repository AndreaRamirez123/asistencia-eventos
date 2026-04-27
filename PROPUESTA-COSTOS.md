# Propuesta de costos — App de registro y control de asistencia

## Resumen

Plataforma web (marca blanca) para registro y control de asistentes a eventos. Se ofrecen **dos modelos de cobro** para que el cliente escoja:

- **Modelo A — Pago por evento** (precio por persona registrada)
- **Modelo B — Membresía** (mensual o anual, eventos ilimitados)

Todos los precios están en **pesos colombianos (COP)** y **NO incluyen IVA** (se suma 19% al facturar).

---

## Modelo A — Pago por evento

Se cobra por **cada persona que se registra** en la app, con un valor mínimo por evento.

### Precios

| Cantidad de personas registradas | Precio por persona |
|---|---|
| Hasta 1.000 | $1.000 COP |
| De 1.001 a 5.000 | $800 COP |
| Más de 5.000 | $700 COP |

> **Mínimo por evento: $1.500.000 COP** (cuando el cálculo por persona no alcanza ese valor).

### Ejemplos

| Evento | Personas | Total |
|---|---|---|
| Capacitación / taller | 300 | **$1.500.000** (mínimo) |
| Conferencia empresarial | 2.000 | **$1.600.000** |
| Feria comercial | 8.000 | **$5.600.000** |
| Feria regional grande | 15.000 | **$10.500.000** |

---

## Modelo B — Membresía

Cuota fija que da acceso a **eventos ilimitados** dentro de un cupo mensual o anual de asistentes.

### Planes

| Plan | Cupo de asistentes/mes | Mensual | Anual (1 mes gratis) |
|---|---|---|---|
| Básico | Hasta 2.000 | $700.000 | $7.000.000 |
| Empresarial | Hasta 10.000 | $1.500.000 | $15.000.000 |
| Corporativo | Ilimitado | $3.500.000 | $35.000.000 |

> Si en algún mes se excede el cupo, el excedente se cobra al precio del Modelo A. **El servicio nunca se interrumpe.**

---

## ¿Cuál modelo conviene?

| Si el cliente... | Recomienda |
|---|---|
| Hace 1-2 eventos al año | **Modelo A** |
| Hace 3 o más eventos al año | **Modelo B** |
| Hace solo un evento grande puntual | **Modelo A** |
| Quiere la herramienta siempre disponible | **Modelo B Corporativo** |

---

## Servicios adicionales (cotización aparte)

| Servicio | Precio |
|---|---|
| Onboarding y capacitación inicial | $500.000 - $1.500.000 |
| Personalización a medida (por hora dev) | $150.000 / hora |
| Integración con CRM o correos masivos | $1.500.000 - $5.000.000 |
| Hardware (tablets, soportes, impresión) | costo + 25% |

---

## Forma de pago

- **Modelo A**: 50% al firmar el contrato + 50% al cierre del evento (ajustado por personas reales).
- **Modelo B**: pago mensual por adelantado, o anual con 1 mes gratis.

---

## Política básica de cancelación (Modelo A)

| Cuándo se cancela | Qué se retiene |
|---|---|
| Más de 15 días antes | 20% del anticipo |
| Menos de 15 días antes | 100% del anticipo (50% del total) |
| El día del evento o después | 100% del valor estimado |

---

## Margen de descuento

- Hasta **15% de descuento** sin afectar rentabilidad.
- Más del 15% requiere aprobación de gerencia.
- Nunca por debajo del mínimo de $1.500.000 por evento.

---

## Costos operativos reales (uso interno)

Cifras calculadas con pricing oficial de Google Firebase (plan Blaze) y costos típicos de mercado en Colombia.

### Costos de infraestructura por evento

Por cada asistente: ~3 escrituras y ~5-10 lecturas a Firestore.

| Tamaño del evento | Costo Firebase aproximado | En COP |
|---|---|---|
| Hasta 500 personas | $0 (cabe en free tier) | $0 |
| 2.000 personas | ~$0,10 USD | ~$400 |
| 5.000 personas | ~$0,50 USD | ~$2.000 |
| 15.000 personas | ~$2 USD | ~$8.000 |

> Firebase es muy económico para esta app porque las funciones costosas (OCR de cédula, generación de QR, lectura de código de barras) corren en el navegador del usuario, no en nuestros servidores.

### Costos fijos mensuales

| Concepto | Costo |
|---|---|
| Dominio personalizado | $40.000 - $80.000 COP/año |
| Firebase Hosting | $0/mes (10 GB gratis sobran) |
| Firebase Authentication | $0/mes (gratis hasta 50.000 usuarios activos) |

**Total infraestructura mensual aproximada**: menos de **$50.000 COP/mes** para un cliente con 1-2 eventos al mes.

### Costos de IA

La aplicación tiene **una sola función con inteligencia artificial**: leer automáticamente los datos de una foto de cédula (nombres, apellidos y número de documento).

**¿Cómo se usa?**
El asistente le toma foto a su cédula desde el celular. La IA lee el texto y llena el formulario solo. El asistente solo confirma y envía.

**¿Cuánto cuesta esta IA?**
**$0**. No importa cuántas veces se use, no se paga nada.

**¿Por qué es gratis?**
La IA corre dentro del navegador del celular del asistente (no en nuestros servidores). El modelo se descarga una sola vez al dispositivo del usuario y después funciona ahí. Esto significa:
- **Cero gasto recurrente**: no pagamos por uso a proveedores como OpenAI, AWS o Google.
- **Privacidad**: las fotos de cédula nunca salen del celular del usuario.

**¿Tiene alguna desventaja?**
Sí, una pequeña: la primera vez que un usuario usa esta función, su celular descarga el modelo (unos 10 MB, ~30 segundos en buena señal). Después queda guardado y es instantáneo. Las siguientes veces es inmediato.

### Costos de tiempo humano (lo que más pesa)

Aquí están los costos reales que justifican el precio al cliente:

| Concepto | Tiempo aproximado | Costo aproximado |
|---|---|---|
| Mantenimiento técnico mensual | 5-10 horas dev | $400k - $1.500k |
| Setup inicial de un cliente nuevo | 8-16 horas dev | $640k - $2.400k |
| Capacitación al equipo del cliente | 2-4 horas | $160k - $600k |

> Tarifa de referencia: $80.000 - $150.000 COP por hora de desarrollo (mid-senior en Colombia).

### Margen estimado por evento

Ejemplo: evento de 5.000 asistentes con Modelo A.

| Concepto | Valor |
|---|---|
| Facturación al cliente (5.000 × $800) | $4.000.000 |
| Firebase | ~$2.000 |
| Parte proporcional de mantenimiento | $200.000 - $500.000 |
| **Margen bruto aproximado** | **$3.500.000 - $3.800.000** |

---

*Documento de costos. Otros documentos complementarios cubren funcionalidades, alcance técnico, supuestos y FAQ.*
