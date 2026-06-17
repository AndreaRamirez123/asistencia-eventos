# Propuesta de costos — Plataforma de gestión de eventos

**Versión para revisión interna** | Precios en pesos colombianos (COP) | Tasa de referencia: 1 USD = $3.631 COP

---

## ¿Qué es este producto?

Es una **plataforma web** que permite a empresas organizar eventos de forma profesional. Los asistentes no necesitan instalar ninguna aplicación — todo funciona desde el navegador del celular o computador.

**Lo que hace la plataforma:**

| Función | Para quién | Cómo funciona |
|---|---|---|
| Registro de asistentes | El asistente | Llena un formulario en su celular. Queda registrado y recibe su código QR |
| Check-in en la puerta | Staff del evento | Escanea el QR con la cámara del celular. Sin dispositivos especiales |
| Mapa del evento | El asistente | Ve un plano con los puntos de visita (estaciones) |
| Estaciones con QR | El asistente | Escanea el QR de cada estación al visitarla |
| Trivia interactiva | El asistente | Responde preguntas en su celular al llegar a cada estación. Puede tener temporizador |
| Mi recorrido | El asistente | Ve cuáles estaciones ha visitado y un mensaje cuando completa el recorrido |
| Calificación del evento | El asistente | Puntúa el evento con estrellas y comentario |
| Panel del organizador | Admin de la empresa | Gestiona asistentes, eventos, estaciones, reportes y estadísticas en tiempo real |
| Exportar datos | Admin de la empresa | Descarga un archivo Excel con todos los asistentes y sus datos |
| Acceso por roles | Admin y staff | El admin tiene control total; el staff solo puede hacer check-in |

**Cada empresa cliente tiene su propio espacio independiente** con su logo, colores corporativos y dirección web personalizada (ejemplo: `plataforma.com/e/nombre-empresa/`).

---

## Resumen ejecutivo — costos y ganancias

| | Plan Piloto | Plan Básico | Plan Mediano | Plan Grande | Plan Recurrente |
|---|---|---|---|---|---|
| **¿Para quién?** | Evento de prueba | Evento pequeño | Evento mediano | Evento grande | Cliente frecuente |
| **Capacidad** | Hasta 500 personas | Hasta 2.000 personas | Hasta 5.000 personas | Hasta 15.000 personas | 4 eventos de 5.000 |
| **Cobro de activación** | $500.000 | $500.000 | $500.000 | $500.000 | $500.000 |
| **Cobro mensual al cliente** | $1.000.000 | $1.100.000 | $1.500.000 | $2.000.000 | $3.800.000 |
| Nuestro costo mensual | ~$400.000 | ~$400.000 | ~$401.000 | ~$416.000 | ~$424.000 |
| **Ganancia mensual** | **~$600.000** | **~$700.000** | **~$1.099.000** | **~$1.584.000** | **~$3.376.000** |
| **Margen de ganancia** | **60 %** | **64 %** | **73 %** | **79 %** | **89 %** |
| Ingreso total en 1 año | $13.000.000 | $14.400.000 | $19.500.000 | $26.500.000 | $47.600.000 |
| Costo total en 1 año | $5.900.000 | $6.000.000 | $6.312.000 | $7.492.000 | $7.088.000 |
| **Ganancia en 1 año** | **$7.100.000** | **$8.400.000** | **$13.188.000** | **$19.008.000** | **$40.512.000** |

> El ingreso anual incluye el pago de activación más 12 cuotas mensuales.
> El costo mensual es el mantenimiento de la plataforma (4 h = $400.000) + costo de servidor si aplica. El soporte por evento se cobra aparte.

---

## ¿En qué consisten nuestros costos?

### 1. Activación — $500.000 (pago único)

Se cobra una sola vez al inicio. Cubre:

| Qué incluye | |
|---|---|
| Acceso a la plataforma | Incluido |
| URL personalizada del cliente | Incluido |
| Capacitación al administrador y staff | Incluido |

> Si el cliente no tiene administrador propio, la configuración inicial se cotiza aparte.

### 2. Cuota mensual — según plan

Cubre el acceso continuo, actualizaciones y funcionamiento del sistema. El único costo de operación real es el servidor de Google Firebase.

| Costo de servidor Firebase | Por evento |
|---|---|
| Hasta 1.333 asistentes | $0 |
| Hasta 2.000 asistentes | $65 COP |
| Hasta 5.000 asistentes | $523 COP |
| Hasta 10.000 asistentes | $1.286 COP |
| Hasta 15.000 asistentes | $2.049 COP |

> El QR, el escaneo y la trivia corren directamente en el celular del usuario — costo de servidor $0.
> El soporte presencial durante el evento se cotiza aparte si el cliente lo requiere.

### 3. Servidor y base de datos — infraestructura

La plataforma usa los servidores de Google, que son **prácticamente gratuitos** para eventos pequeños y medianos. Solo se empieza a cobrar cuando hay más de 10.000 asistentes en un mes.

| Plan | Costo de servidor / mes |
|---|---|
| Piloto (500 personas) | $0 |
| Básico (2.000 personas) | $85 |
| Mediano (5.000 personas) | $756 |
| Grande (15.000 personas) | $15.708 |
| Recurrente (4 × 5.000) | $23.520 |

El servidor cuesta poco porque el QR, el escaneo y la trivia se procesan directamente en el celular del usuario — no necesitamos servidores adicionales.

---

## Proyección con varios clientes activos

El mantenimiento de la plataforma (4 horas al mes) es un costo fijo compartido — no se cobra una vez por cada cliente. A más clientes, mayor el margen:

| Clientes activos | Ingresos / mes | Costo total / mes | Ganancia / mes |
|---|---|---|---|
| 1 cliente (Plan Básico) | $1.100.000 | $400.000 | $700.000 — 64 % |
| 3 clientes | $3.300.000 | $400.000 | $2.900.000 — 88 % |
| 5 clientes | $5.500.000 | $400.000 | $5.100.000 — 93 % |
| 10 clientes | $11.000.000 | $400.000 | $10.600.000 — 96 % |

> Costo = 4 h mantenimiento compartido ($400.000). Soporte por evento y servidor se suman si aplica.

---

## Lo que NO está incluido — se cotiza aparte

- **Hardware:** tablets para registro en sitio, impresión de QR, pendones
- **Correos masivos:** notificaciones por email a los asistentes
- **Integraciones externas:** conexión con otros sistemas (CRM, pagos, plataformas de terceros)
- **Disponibilidad garantizada en el evento:** soporte presencial o en línea durante el evento
- **Asistentes por encima del límite del plan contratado**

---

## Anexo técnico — solo para el equipo de desarrollo

**Tecnología utilizada:**
- La plataforma es una aplicación web construida con React y Vite
- La base de datos y el hosting son de Google (Firebase) — sin servidores propios
- Solo los administradores y el staff se registran con cuenta; los asistentes no necesitan cuenta
- El escaneo y la generación de QR se hacen en el celular, sin costo de servidor
- No se usan funciones en la nube adicionales (Cloud Functions) — costo $0

**Estimado de uso por asistente (base de los cálculos):**
- Consultas a la base de datos: ~25 por asistente por evento
- Registros en la base de datos: ~15 por asistente por evento (registro, check-in, visitas, trivia, calificación)
- Peso de la app: ~0,45 MB comprimido (medido en producción)

**Umbrales gratuitos de Google Firebase:**
- 50.000 consultas gratis por día
- 20.000 registros gratis por día
- 10 GB de descarga gratis por mes

**Seguridad de los datos:**
- Reglas de acceso por rol implementadas en la base de datos
- Solo el superadministrador puede crear o eliminar empresas clientes
- Los datos de los asistentes están protegidos — solo el personal autorizado puede verlos

**Tasa de cambio:** 1 USD = $3.631 COP (01/06/2026).
