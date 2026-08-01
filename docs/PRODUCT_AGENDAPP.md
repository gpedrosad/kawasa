# AgendApp — contexto de producto

Fuente de hechos para Kapso / agentes. **No inventar** features, precios ni métricas.  
Flujo de calificación + audio (pendiente, no implementar): [`KAPSO_WHATSAPP_QUALIFY.md`](KAPSO_WHATSAPP_QUALIFY.md).

---

## Qué es

App web (SaaS) argentina para que un **profesional de salud independiente** —sobre todo **psicólogo/a**— deje de coordinar turnos a mano por WhatsApp.

**Promesa core:** los pacientes **reservan solos**, reciben **recordatorios**, pueden **pagar seña**, y el sistema **sigue después del turno** (rebook / win-back). No es “solo una agenda”: es agenda + cobro + seguimiento.

**Una línea:** *Link de turnos + recordatorios + seña + recuperar pacientes que no volvieron.*

## Para quién / no

| Sí (ICP) | No |
|---|---|
| Psicólogos/as independientes en **Argentina** | Clínicas / hospitales / equipos grandes |
| Otros profesionales de salud 1-persona (nutri, kinesio, fono…) si el dolor encaja | Otro país / otra moneda |
| Presencial, online o mixto | Solo “aparecer en un directorio” |
| Hoy coordinan por chat, papel o planillas | Multi-profesional / recepción |

## 4 pilares (priorizar según dolor)

1. **Reservan solos** — `agendapp.com.ar/{nickname}`
2. **Recordatorios** — WhatsApp + email, típico 24h y 4h
3. **Cobro / seña** — Mercado Pago (también transferencia)
4. **Seguimiento / retención** — rebook + win-back 30/60/90 sin escribir uno por uno

Extras solo si preguntan: Google Calendar, notas/carpeta, digest semanal, reseñas, cancelación con reglas del profesional.

## Diferencia vs “otra agenda”

Una agenda común termina al confirmar el turno. AgendApp **sigue después**: continuidad + recuperar quien dejó de venir. Hecho para consultorio independiente AR (MP + WhatsApp).

## Precio y condiciones

- **$18.000 ARS/mes**
- Sin permanencia
- Garantía 30 días
- Setup ~5 minutos
- Suscripción vía Mercado Pago
- ROI suave (sin inventar %): con recuperar 1 sesión / 1 paciente ya se acerca a pagar el mes (sesiones típicas ICP ~$25k–40k)

## Links

| Uso | URL |
|---|---|
| Home | https://www.agendapp.com.ar |
| Landing | https://www.agendapp.com.ar/landing |
| Retención | https://www.agendapp.com.ar/landing-retencion |
| Suscribirse | https://www.agendapp.com.ar/suscribirse |
| Hub psicólogos | https://www.agendapp.com.ar/agenda-para-psicologos |

Un solo link por cierre, el que matchee el dolor.

## Cómo hablar

**Sí:** dejar de coordinar por WA; link + recordatorios + seña; si dejan de venir, AgendApp sigue; independiente AR; Gonzalo = fundador / voz de los audios.

**No:** features no listadas; métricas inventadas; clínicas grandes / fuera de AR; comparaciones agresivas no verificadas.

## Claims numéricos permitidos

- “1 de cada 8 WhatsApps de seguimiento termina en una nueva reserva.”
- “El paciente reagenda solo. En menos de 3 días.”

Usar sobre todo en retención/rebook.

## FAQ corto

| Pregunta | Respuesta |
|---|---|
| ¿Cuánto? | $18.000/mes, sin permanencia |
| ¿Prueba? | Garantía 30 días |
| ¿No soy psicólogo/a? | Salud independiente 1-persona en AR; calificar dolor |
| ¿Reemplaza WhatsApp? | Saca la coordinación de turnos del chat |
| ¿App? | Web (navegador) |
| ¿MP? | Sí (seña paciente + suscripción) |
| ¿Google Calendar? | Sí |
| ¿Clínica con 5 profesionales? | No es el foco; 1 profesional independiente |

## Ángulo → link (primer contacto)

En el flujo de primer contacto mandar **landing**, no checkout.

| Dolor | Enfatizar | Link |
|---|---|---|
| Ida y vuelta | Reservan solos | `/landing` |
| Ausencias | Recordatorios (+ seña) | `/landing` |
| Cobrar | Seña / pago MP | `/landing` |
| Dejan de venir | Rebook + win-back | `/landing-retencion` |
| Solo precio | Precio + pilares | `/landing` |

`/suscribirse` solo si el lead pide explícitamente pagar / activar.
