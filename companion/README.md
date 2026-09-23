# RASTHOR·IA Companion — v0.1

RASTHOR·IA Companion es una extensión local para Chrome/Edge que convierte ChatGPT en una mesa de rol persistente **sin usar API, sin API keys y sin comprar tokens aparte**.

La IA sigue siendo ChatGPT en `chatgpt.com`. La extensión se encarga de la ficha, dados, inventario, mundo, misiones, NPC, diario, voz y guardado local de campaña.

## Instalar

1. Descarga o clona esta carpeta `companion`.
2. Abre `chrome://extensions/` (o `edge://extensions/`).
3. Activa **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida**.
5. Selecciona la carpeta `companion`.
6. Abre `https://chatgpt.com/`.
7. Pulsa el botón `R·IA` que aparece abajo a la derecha.

## Cómo se juega

1. Crea una campaña en la pestaña **IA**.
2. Completa tu ficha y el mundo.
3. Escribe una acción en **IA > Acción del jugador**.
4. Si hay una tirada, hazla en **Dados**. El último resultado queda disponible para el turno.
5. Pulsa **Preparar turno en ChatGPT**. La extensión pone un paquete de contexto en el cuadro de texto; tú decides cuándo enviarlo.
6. Después de que ChatGPT responda, pulsa **Importar última respuesta**. La extensión guarda la narración y procesa el bloque opcional `[RASTHORIA]...[/RASTHORIA]`.

## Protocolo de estado

El paquete enviado a ChatGPT pide que, cuando cambie algo mecánico, agregue al final un bloque como:

```text
[RASTHORIA]
hp:-4
hora:+10min
inventario:+Llave oxidada
diario:+La puerta del campanario estaba protegida por una trampa.
mision:+Encontrar al campanero desaparecido
npc:+Elara|Desconfía del personaje, pero conoce las catacumbas.
lugar:+Catacumbas del campanario|Entrada oculta tras el altar.
[/RASTHORIA]
```

La extensión entiende `hp`, `xp`, `dinero`, `hora`, `dia`, `inventario`, `diario`, `mision`, `mision_completar`, `npc`, `lugar` y `estado`.

## Privacidad

- No hay backend propio.
- No hay API de OpenAI.
- No se envían datos a un servidor de RASTHOR·IA.
- Las campañas se guardan en `chrome.storage.local` de tu navegador.
- Exportar campaña genera un JSON local que puedes guardar como respaldo.

## Limitación intencional

La extensión no pulsa “Enviar” por ti. Prepara el turno en el compositor de ChatGPT y mantiene un modo manual de copiar/pegar. Esto evita depender de automatizaciones frágiles de la interfaz.
