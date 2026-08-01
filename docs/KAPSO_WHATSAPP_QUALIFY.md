# WhatsApp Kapso — primer contacto

**2–3 preguntas → audio corto.** Calificar y presentarse; no cerrar venta.

**Estado: SOLO DOCUMENTADO. No implementar todavía.**

Producto: [`PRODUCT_AGENDAPP.md`](PRODUCT_AGENDAPP.md).

---

## Alcance

- Sí: profesión, cómo agenda, dolor → audio → 1 landing.
- No: checkout, “activá”, perseguir, FAQ larga, demo completa.

---

## Preguntas

**1**
```
Hola! Soy Gonzalo de AgendApp, ¿a qué te dedicás?
```

**2** (abierta, sin listar opciones)
```
Buenísimo. ¿Y hoy cómo estás armando los turnos?
```

**3** (botones)
```
¿Y qué te está jodiendo más ahora?
```

| Botón | Tag |
|---|---|
| Ida y vuelta para agendar | `coordinacion` |
| Ausencias / se olvidan | `ausencias` |
| Cobrar / que paguen | `cobros` |
| Que dejan de venir | `retencion` |

Si pide precio antes: `Dale, te lo cuento en un audio — ¿a qué te dedicás?`

---

## Audio

- Nota de voz (`voice: true`), **35–50 s**.
- Esperar un rato después del dolor (no al instante).
- Espejar 1 dato + 1 escena del dolor + 1 idea de AgendApp + precio al pasar.
- Cierre suave: “te dejo el link por si querés mirarlo”.
- No: catálogo de features, “activarlo”, “suscribite”.

Ángulo del audio = dolor (ver pilares en producto). Guiones largos: no hace falta; improvisar con eso.

---

## Después del audio

Una línea + **un** link landing:

- coordinación / ausencias / cobros → `https://www.agendapp.com.ar/landing`
- retención → `https://www.agendapp.com.ar/landing-retencion`

`/suscribirse` solo si lo piden.

```
Te tiré un audio rapidito 🙂
```

---

## No-fit

```
Gracias por escribir! Hoy AgendApp es para profesionales independientes de salud en Argentina. Si eso cambia, avisame 🙂
```

---

## Tags

`profesion` · `herramienta` · `dolor` · `audio_enviado` · `etapa=primer_contacto`
