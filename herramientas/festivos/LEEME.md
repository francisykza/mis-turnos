# Actualizar los festivos

Cada octubre el BOE publica la «relación de fiestas laborales» del año siguiente.

1. Busca la resolución en boe.es y guarda su versión HTML (`txt.php?id=BOE-A-...`) como `boe/fAAAA.html`.
2. Conviértela a datos: `python -I boe_a_json.py boe/fAAAA.html AAAA boe/jAAAA.json`
3. Añade el año y el identificador del BOE en `fuentes` dentro de `generar.js`.
4. Genera el archivo de la app: `node generar.js ../../js/festivos.js`
5. Sube `CACHE` en `sw.js` para que los móviles lo descarguen.
