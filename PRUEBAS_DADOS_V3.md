# Pruebas de dados V3

Ejecutadas el 22 de septiembre de 2026 sobre Chromium automatizado con WebGL por software. Se inspeccionaron capturas de los dados detenidos y de etapas del movimiento. No es una medición del rendimiento en un equipo físico del usuario.

## Validación funcional y visual

| Caso | Comprobación | Resultado |
|---|---|---|
| D4, D6, D8, D10, D12, D20 | Resultado 1 y máximo de cada tipo | Correcto |
| D100 | 1, 73 y 100; decenas/unidades correspondientes | Correcto |
| Ventaja / desventaja | Valores 1 y 20; selección y descarte | Correcto |
| Empates | Dos D20 con valor 8, ambos modos | Correcto |
| Dos dados | 2D12 con 4 y 12 | Correcto |
| Cuatro dados | 4D6 con 1, 2, 5 y 6 | Correcto |
| Repetición | 18 tiradas secuenciales y pruebas adicionales del D10/D100 | Sin bloqueos |
| Duplicación | Dos llamadas simultáneas con el mismo objeto | Una presentación, misma promesa |
| Cola | Una segunda tirada distinta mientras la primera está activa | Dos presentaciones completas en orden |
| Datos | Comparación del objeto y valores antes/después | Sin mutaciones |
| Contacto con suelo | Altura de todos los vértices en los fotogramas grabados; proyección durante interpolación | Sin penetración del suelo |
| Orientación | Producto escalar entre eje de resultado y vertical > 0,9999 | Correcto |
| Reposo | Pose final fija y contador de render sin cambios durante 700 ms de inactividad | Correcto |
| Movimiento reducido | Sin reproducción animada; posición final estática | Correcto |
| Sin WebGL | Constructor sin contexto gráfico, resultado 17 | Resultado visible y promesa resuelta |
| Pérdida de contexto | WebGL perdido durante una tirada con resultado 13 | Fallback y continuación |
| Pantalla estrecha | 390 × 844, cuatro dados | Bandeja dentro de pantalla |
| Pantalla horizontal | 844 × 390, cuatro dados | Bandeja dentro de pantalla |
| Integración real | Crear partida de prueba y usar «Lanzar 1D20» | Dado e historial coinciden; botón vuelve a habilitarse |

La matriz principal terminó con 18 casos aprobados y ningún error de página. La batería adicional terminó con 13 grupos aprobados y ningún error de página. Tras ajustar la forma del D10 y el encuadre de cuatro dados se repitieron los casos afectados.

Las tiradas normales de la matriz principal duraron entre 1,458 y 2,350 segundos, más la pausa de lectura. Los registros completos están en `pruebas/matriz.json` y `pruebas/casos_adicionales.json`.

## Alcance del cambio

Se comparó el contenido con el ZIP V2 de entrada. Solo cambiaron `assets/dice-arena.js`, `assets/dice-arena.css`, `DADOS_LAB.html` e `index.html`. En `index.html` solo cambiaron los enlaces/versiones de recursos de dados y se añadió la carga de Cannon.

Los tres bloques JavaScript incorporados en base64 conservan exactamente sus hashes SHA-256. Los archivos del Worker y Three.js también permanecen idénticos. Por tanto, no se modificó el RNG criptográfico del juego, ni sus reglas o guardados.

No se ejecutó una aventura conectada al Director remoto: el servicio no fue accesible desde el entorno de prueba. La integración se verificó mediante las tiradas libres reales del juego y el mismo contrato asíncrono que utiliza la historia.

## Dependencias

- Three.js 0.160.1, ya presente en V2, sin modificaciones.
- cannon-es 0.20.0, distribución CommonJS oficial envuelta para cargarla como script local; adaptación de `perf_hooks` a `window.performance` para navegador. Licencia MIT incluida.
- No se necesitan CDN, paquetes npm ni cambios en el Worker para utilizar esta versión.
