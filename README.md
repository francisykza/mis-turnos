# Mis Turnos

App web instalable (PWA) para fichar turnos rotativos y controlar horas extra, festivos, bajas y una estimación de la nómina.

**Demo:** https://francisykza.github.io/mis-turnos/

**Autor:** Francisco Muñoz Dorado · [@francisykza](https://github.com/francisykza)

---

## El problema

Trabajo con turnos rotativos: una semana de mañana y la siguiente de tarde, cada una con su día de descanso. Las horas extra se liquidan por periodos que van del día 20 de un mes al 19 del siguiente, no por meses naturales.

Llevar la cuenta a mano era lento y daba pie a errores, y comprobar si la nómina cuadraba con lo trabajado no era sencillo. Las apps de fichaje genéricas no contemplaban ni la rotación ni ese periodo de liquidación.

## La solución

Una app que vive en la pantalla de inicio del móvil y permite fichar en un toque. Sabe qué turno toca cada día y calcula sola las extras, las horas festivas y una estimación del sueldo.

## Funcionalidades

- **Fichaje rápido:** entrada y salida con la hora actual, o "turno completo" en un toque.
- **Turnos rotativos automáticos:** alterna mañana y tarde cada semana, con su día de descanso.
- **Contador de horas extra** del periodo de liquidación (configurable, por defecto del 20 al 19).
- **Calculadora de extras:** "si entro a las 5:20, ¿cuántas extras me supone?"
- **Festivos:** los nacionales vienen precargados y los autonómicos o locales se marcan con un toque.
- **Vacaciones y bajas** por rangos de días.
- **Estimación de nómina:** salario base, complementos, prorrata de pagas, Seguridad Social, IRPF, precio de la hora extra y la festiva, y tramos de incapacidad temporal (0 % / 60 % / 75 %) o complemento por convenio.
- **Copia de seguridad** en JSON (exportar e importar).
- **Funciona sin conexión** y se instala como una app nativa.
- **Dos aspectos visuales:** "Neón", con lluvia animada en canvas, y "Clásico".

## Reglas de negocio implementadas

| Situación | Cómo se computa |
|---|---|
| Día laborable | Extra = tiempo trabajado por encima del turno previsto |
| Día de descanso | Todo lo trabajado cuenta como extra |
| Festivo | Todo lo trabajado cuenta como hora festiva |
| Baja (IT común) | Días 1–3: 0 %, días 4–20: 60 %, día 21 en adelante: 75 % de la base (o 100 % según convenio) |
| Periodo de liquidación | Del día de corte (20) al día anterior del mes siguiente |

La estimación de nómina se validó con nóminas reales y cuadra al céntimo en un mes completo.

## Tecnología

- HTML, CSS y JavaScript sin frameworks ni dependencias.
- PWA: Web App Manifest y Service Worker (caché sin conexión, red primero para recibir actualizaciones).
- `localStorage` para los datos: nada sale del dispositivo.
- Canvas 2D para la animación de lluvia y ciudad. Respeta `prefers-reduced-motion`.
- Diseño mobile-first con soporte de áreas seguras (notch) y modo claro u oscuro.

## Cómo se hizo

El análisis del problema, los requisitos, las reglas de cálculo y la validación con nóminas reales son míos. El código lo desarrollé con **Claude (Anthropic)** como asistente de programación, iterando sobre cada funcionalidad a partir del uso real en el día a día.

## Privacidad

Los datos (fichajes y datos de nómina) se guardan únicamente en el navegador del dispositivo. No hay servidor ni analítica.

> La estimación de nómina es orientativa y no sustituye a la nómina oficial ni a asesoramiento laboral.

## Licencia

[MIT](LICENSE) © 2026 Francisco Muñoz Dorado
