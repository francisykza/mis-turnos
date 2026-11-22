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

- **Fichaje rápido:** entrada y salida con la hora actual, o "turno completo" en un toque. Cada fichaje se puede deshacer durante 5 segundos.
- **Pantalla de inicio:** minimalista: la hora, el turno de hoy y un botón redondo para fichar con un anillo que se llena según avanza el turno. «Apuntar» abre extras (+30 min, +1 h u otra cantidad), turno completo, festivo, vacaciones o baja. Con el modo RPG activo es «La jornada»: la puerta de tu trabajo en pixel art, con el cielo según la hora real, lluvia, la garita de Paco el vigilante y Mancha la gata. Al fichar, tu personaje camina al reloj, mete la tarjeta y entra; al salir, ficha y se va calle abajo. Paco comenta tu día y de vez en cuando pasa algo (el repartidor, un apagón, una estrella fugaz). Con el modo RPG activo, toda la app toma ese aspecto: paneles de píxel, iconos dibujados a mano, la nómina en un sobre con lacre y Paco comentando en Hoy y en Nómina. Desde la app se vuelve tocando el logo.
- **Turnos configurables:** un asistente con plantillas (mañana y tarde alternas, mañana-tarde-noche, horario fijo, días seguidos de trabajo y descanso) o un ciclo dibujado día a día, de hasta 6 semanas y 4 turnos. Admite turnos de noche que cruzan la medianoche. Si cambias de turnos «desde hoy», los periodos pasados no se recalculan.
- **Contador de horas extra** del periodo de liquidación (configurable, por defecto del 20 al 19).
- **Calculadora de extras:** "si entro a las 5:20, ¿cuántas extras me supone?"
- **Festivos por comunidad autónoma:** los nacionales y los de tu comunidad salen del BOE (2026 y 2027 oficiales; los años siguientes, previstos con Semana Santa calculada). Los locales se marcan con un toque.
- **Vacaciones y bajas** por rangos de días.
- **Estimación de nómina:** salario base, complementos, prorrata de pagas, Seguridad Social, IRPF, precio de la hora extra y la festiva, y tramos de incapacidad temporal (0 % / 60 % / 75 %) o complemento por convenio.
- **Simulador de horas:** "si este periodo echo 6 h extra y trabajo un descanso, ¿cuánto cobraría?". Suma lo imaginado a lo ya fichado, compara el neto y dice cuánto deja limpio cada hora extra y festiva. También día a día: eliges cuánto echarías cada día (con «turno entero» en descansos y festivos) y ves lo que te deja cada uno. No apunta nada en los fichajes.
- **¿Te han pagado bien?:** apuntas el neto cobrado y las horas extra y festivas que pone tu nómina, y la app las compara con lo fichado: dice si cuadra o cuántas horas (y euros brutos aproximados) faltan.
- **Informe para reclamar:** registro de jornada del periodo, día a día, con totales, horas pendientes de pago, criterios de cálculo y espacio para firmar. Se imprime o se guarda como PDF desde el móvil, o se comparte como texto.
- **Copia de seguridad:** se guarda con el menú Compartir del móvil (Archivos, Drive, correo…) y la app avisa en Hoy si hay cambios sin copia desde hace 14 días. Recuperar una copia pide confirmación.
- **Modo RPG (opcional):** un pequeño RPG del mundo laboral. Una escena pixel art de la ciudad que cambia con la hora real, con tu personaje frente al jefe del periodo (babosas, robots, relojes y gólems de papeleo): al fichar, el personaje ataca y el jefe pierde vida. Niveles y rangos, monedas, tienda de equipo (cascos, visores, trajes, capas y mascotas), misiones del día y de la semana, un evento diario que cambia las reglas, atributos y energía (avisa si encadenas muchos días sin descanso), diario de batalla y 15 logros. Todo se calcula a partir de los fichajes, y las horas extra no dan experiencia: se premia la constancia, no echar más horas. La pestaña Héroe es un menú de juego (Estado, Misiones, Tienda, Diario y Logros). Efectos de sonido opcionales.
- **Animaciones:** el contenido entra escalonado al cambiar de pestaña, los números cuentan hasta su valor y las barras se llenan. Se desactivan si el móvil tiene activado «Reducir movimiento».
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
