# Olympus: familias de modelos automáticas y razonamiento por ejecución

## Problema

Olympus guarda actualmente nombres completos como `Opus 5` y exige que la aplicación nativa muestre exactamente ese texto. Cuando Claude reemplaza ese modelo por `Opus 5.5`, Olympus deja de iniciar el ciclo aunque la familia solicitada, Opus, siga disponible. El mismo problema puede repetirse con ChatGPT.

El nivel de razonamiento también se hereda de la configuración guardada y no puede cambiarse al iniciar una ejecución. El usuario quiere trabajar normalmente con razonamiento **Alto**, pero poder elegir otro nivel para una nueva generación sin alterar el valor general, por ejemplo después de haber obtenido una entrega 10/10.

Este diseño sustituye únicamente las reglas de selección exacta y esfuerzo descritas en `2026-09-15-ai-models-prompts-study-report-design.md`. La jerarquía general → materia → trabajo, los prompts, el ciclo académico y el informe técnico conservan su comportamiento.

## Decisión general

Los modelos conocidos se configurarán por **familia** y Olympus seleccionará la versión numérica más reciente que la aplicación instalada ofrezca para esa familia. Una preferencia `Claude Opus` podrá resolver hoy a `Opus 5.5` y más adelante a una versión superior sin cambiar la configuración.

Olympus nunca cambiará automáticamente de familia. Si se solicita Opus y sólo está disponible Sonnet, la ejecución se detendrá con una explicación concreta. La opción existente **Otro modelo** conservará la coincidencia exacta para permitir modelos todavía desconocidos por el catálogo de Olympus.

El razonamiento conservará la jerarquía general → materia → trabajo y añadirá un reemplazo temporal por ejecución. Los valores iniciales del selector de una ejecución serán los efectivos del trabajo. Cambiarlos afectará únicamente esa ejecución y sus rondas automáticas; no modificará Supabase ni la configuración de la materia o del TP.

## Preferencias de modelo

El catálogo web mostrará preferencias estables en lugar de versiones cerradas:

- Claude Opus — última versión disponible.
- Claude Sonnet — última versión disponible.
- Las familias conocidas que ofrezca ChatGPT, identificadas por su nombre estable, por ejemplo Astra, Sol, Terra o Luna.
- Otro modelo — nombre exacto visible en la aplicación.

La preferencia enviada al puente nativo tendrá una estructura explícita:

- `provider`: `claude` o `chatgpt`;
- `modelMode`: `family` o `exact`;
- `model`: identificador canónico de familia o texto exacto;
- `effort`: nivel solicitado para la ejecución.

Los campos de texto actuales de Supabase podrán seguir almacenando la preferencia para evitar una migración destructiva. La capa web traducirá valores conocidos a identificadores canónicos y seguirá aceptando valores exactos personalizados.

### Compatibilidad con datos existentes

Los valores ya guardados se interpretarán de esta forma:

- `Opus 5`, `Opus 5.5` y otras variantes reconocidas pasan a la familia `claude:opus`.
- Las variantes Sonnet pasan a `claude:sonnet`.
- Los nombres versionados conocidos de ChatGPT pasan a su familia estable correspondiente.
- Un valor que Olympus no reconozca se conserva como selección exacta.

La interfaz mostrará la preferencia normalizada, por ejemplo **Opus · última versión**, aun cuando el registro anterior contenga `Opus 5`. Guardar nuevamente la configuración persistirá el identificador canónico. No se borrarán configuraciones, ejecuciones ni entregas anteriores.

## Resolución en las aplicaciones nativas

Antes de iniciar un chat, el adaptador nativo realizará esta secuencia:

1. Abrir el selector de modelos de la aplicación correspondiente.
2. Leer todas las opciones accionables y normalizar mayúsculas, tildes, espacios y signos decorativos.
3. Filtrar exclusivamente las opciones de la familia solicitada.
4. Extraer sus componentes numéricos y ordenar las versiones de mayor a menor.
5. Seleccionar la versión más alta y comprobar nuevamente el control visible.
6. Seleccionar y comprobar el nivel de razonamiento solicitado.
7. Devolver al coordinador el nombre real resuelto y el nivel comprobado.

La comparación de versiones será numérica por componentes: `5.10` será posterior a `5.5`, y `6` será posterior a ambas. Los textos sin versión numérica quedarán después de las opciones versionadas; sólo se usarán si son la única coincidencia de la familia. Los indicadores de precio o multiplicadores, como `1.5×`, no formarán parte de la versión del modelo.

El adaptador no dependerá del orden visual del menú. La detección de Claude y ChatGPT tendrá reglas separadas para que un cambio de una aplicación no altere la otra.

## Razonamiento configurable

La configuración general ofrecerá los niveles que admita cada proveedor. Tanto Claude como ChatGPT usarán **Alto** como valor inicial cuando todavía no exista una preferencia guardada. Una elección ya guardada por el usuario se conservará. Materias y trabajos podrán heredar o reemplazar ese valor como hasta ahora.

El panel de cada ejecución mostrará selectores temporales para:

- Claude en el ciclo de desarrollo y revisión;
- ChatGPT en el ciclo de corrección;
- Claude al generar el informe técnico.

Cada selector comenzará con el valor efectivo del TP e indicará su origen. El usuario podrá elegir otro nivel antes de pulsar **Iniciar**. El valor elegido se mantendrá durante todas las rondas de ese ciclo. Al terminar o recargar la página, el selector volverá al valor heredado, salvo que el usuario lo haya guardado expresamente en la configuración general, la materia o el TP.

Una nueva generación posterior a una entrega 10/10 será una ejecución independiente. El usuario podrá escoger otro esfuerzo antes de iniciarla, y la entrega final ya guardada permanecerá disponible hasta que una nueva ejecución llegue a 10/10 y se publique correctamente.

## Información visible y persistencia

Antes de ejecutar, el panel mostrará la familia solicitada y el razonamiento elegido. Después de comprobar las aplicaciones, el estado mostrará el resultado real, por ejemplo:

`Claude: Opus 5.5 · Alto`

`ChatGPT: GPT-6 Astra · Alto`

La instantánea de la ejecución guardará tanto la preferencia solicitada como la selección resuelta:

- familia o nombre exacto solicitado;
- nombre completo realmente utilizado;
- esfuerzo solicitado y comprobado;
- origen de la configuración;
- formatos solicitados y demás datos que ya conserva el ciclo.

Así, actualizar una preferencia futura no cambiará el registro de qué modelo produjo una entrega anterior.

## Errores y recuperación

- Si no existe ninguna opción de la familia solicitada, Olympus detiene la ejecución y muestra la familia faltante.
- Si encuentra la familia pero no puede comprobar la selección, no envía el prompt.
- Si el nivel solicitado no está disponible para el modelo resuelto, Olympus muestra los datos que pudo detectar y pide elegir otro nivel.
- Si la interfaz cambia y el menú no puede leerse, el error identifica la aplicación afectada y permite reintentar después de actualizar el adaptador.
- Una falla de selección nunca reemplaza la entrega final existente ni publica una generación parcial.
- Olympus no cambia de Opus a Sonnet, ni entre familias de ChatGPT, como mecanismo de recuperación.

## Verificación y criterios de aceptación

La mejora se considerará completa cuando se compruebe lo siguiente:

- Una configuración histórica `Opus 5` se interpreta como familia Opus.
- Si Claude ofrece `Opus 5` y `Opus 5.5`, Olympus selecciona `Opus 5.5`.
- La comparación considera `5.10` posterior a `5.5`.
- Solicitar Opus nunca selecciona Sonnet.
- Un modelo personalizado continúa exigiendo coincidencia exacta.
- La configuración general sin valor previo usa razonamiento Alto.
- Los valores guardados en general, materia y TP conservan su precedencia.
- El usuario puede cambiar el esfuerzo de Claude y ChatGPT para una sola ejecución sin modificar la configuración persistida.
- Las rondas de corrección de una misma ejecución mantienen el esfuerzo elegido al inicio.
- Una nueva ejecución después de 10/10 permite elegir otro esfuerzo y conserva la entrega anterior hasta publicar la nueva.
- La interfaz y la instantánea registran el modelo y el esfuerzo realmente comprobados.
- Pasan los tests unitarios web de normalización, compatibilidad, herencia y reemplazo temporal.
- Pasan los tests nativos de detección de familia, orden de versiones, aislamiento de familias, nivel de esfuerzo y errores.
- Pasan lint, TypeScript, compilación web, pruebas nativas, firma e instalación de la aplicación.
- Una prueba controlada completa confirma el flujo Claude → ChatGPT → Claude usando las aplicaciones instaladas.

## Fuera de alcance

- Olympus no cambia automáticamente entre familias si una no está disponible.
- Olympus no intenta habilitar modelos que la suscripción del usuario no ofrezca.
- Olympus no modifica las aplicaciones de Claude o ChatGPT ni depende de sus API pagas.
- El reemplazo temporal de razonamiento no queda como nuevo valor general, de materia o de trabajo.
- Esta mejora no conserva borradores ni altera la política de guardar únicamente la entrega final aprobada.
