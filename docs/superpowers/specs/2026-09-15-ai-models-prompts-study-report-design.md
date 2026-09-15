# Olympus: modelos configurables, prompts globales e informe técnico

## Problema

Olympus ya puede recibir materiales clasificados, pedir a Claude una entrega Word, Excel o ambas, hacer que ChatGPT la corrija y publicar únicamente el conjunto final aprobado. Sin embargo, los prompts se configuran principalmente al crear una materia y las aplicaciones nativas conservan el modelo que el usuario haya dejado seleccionado. Esto impide controlar desde Olympus qué modelo y nivel de esfuerzo debe participar en cada trabajo.

Además, después de aceptar una entrega final, el usuario necesita crear un documento independiente llamado **Informe técnico de estudio**. Claude debe producirlo en Word, usando un prompt configurable, el contenido académico y el logo del emprendimiento. ChatGPT no corrige este informe.

## Decisión general

Se implementará una configuración en tres niveles:

1. **General:** prompts y modelos predeterminados para toda la cuenta, más un único logo institucional.
2. **Materia:** prompts y modelos que reemplazan los valores generales para esa materia.
3. **Trabajo práctico:** prompts y modelos que reemplazan los valores heredados sólo para ese TP.

El valor efectivo será siempre el primer valor no vacío en el orden TP → materia → general. La pantalla mostrará tanto el valor efectivo como su origen. Elegir un modelo desde un TP guardará esa elección como configuración propia del TP; no modificará la materia ni la configuración general.

Se eligió un control híbrido de las aplicaciones nativas. Olympus intentará seleccionar y verificar automáticamente el modelo y el esfuerzo configurados. Si la interfaz nativa no permite verificar el valor exacto, el ciclo no comenzará y Olympus abrirá la aplicación correspondiente con una instrucción concreta para corregir la selección. Esto evita atribuir una ejecución a un modelo que Olympus no pudo comprobar.

## Configuración general

La navegación principal incorporará una página **Configuración**. Contendrá:

- Prompt general de desarrollo para Claude.
- Prompt general de corrección para ChatGPT.
- Prompt general para el informe técnico de estudio.
- Modelo y nivel de esfuerzo predeterminados de Claude.
- Modelo y nivel de esfuerzo predeterminados de ChatGPT.
- Logo institucional.

Los selectores ofrecerán un catálogo local de modelos conocidos y una opción **Otro modelo** para escribir el nombre visible exacto de una versión nueva. Los niveles de esfuerzo serán `Automático`, `Bajo`, `Medio`, `Alto` y los demás niveles que exponga la aplicación correspondiente. `Automático` significa que no se exigirá un nivel específico, pero el modelo sí deberá verificarse.

El logo se cargará una sola vez. Se admitirán PNG y JPEG de hasta 10 MB. Olympus lo guardará en `Olympus/Configuración/Logo` en Google Drive y registrará solamente sus metadatos e identificador de Drive en Supabase. Reemplazar el logo seguirá una operación segura: primero se cargará el nuevo archivo y, después de comprobarlo, se eliminará el anterior. La interfaz permitirá descargarlo, abrirlo en Drive, reemplazarlo o eliminarlo.

Si todavía no existe configuración general, las materias actuales continuarán usando sus prompts existentes. La migración no borrará ni reinterpretará esos valores.

## Configuración de materia y TP

La página de cada materia tendrá una sección **IA y prompts de la materia**. Allí se podrán definir:

- Prompt de desarrollo.
- Prompt de corrección.
- Prompt de informe técnico.
- Modelo y esfuerzo de Claude.
- Modelo y esfuerzo de ChatGPT.

Cada campo podrá quedar en modo **Usar configuración general**. Al crear una materia nueva, Olympus no copiará los textos generales: guardará las excepciones y resolverá la herencia al abrir cada TP. Así, un cambio posterior en la configuración general se aplicará a todas las materias que no tengan una excepción.

La sección actual **Configuración del trabajo** incorporará los tres prompts y los dos selectores de modelo. Cada control mostrará el valor heredado y permitirá elegir **Usar configuración de la materia**. Antes de comenzar, el panel de desarrollo presentará un resumen de:

- modelo y esfuerzo efectivos de Claude;
- modelo y esfuerzo efectivos de ChatGPT;
- origen de cada selección;
- formatos finales requeridos;
- estado de los materiales y prompts.

Los prompts vacíos seguirán bloqueando la ejecución. La selección de modelos no se añadirá al texto del prompt como si pudiera cambiar el modelo: se enviará por separado al puente nativo para que Olympus controle la aplicación real.

## Preparación y verificación de modelos

El puente web enviará una configuración estructurada para cada aplicación: proveedor, nombre visible del modelo y esfuerzo. Antes de abrir un chat nuevo, el adaptador nativo realizará esta secuencia:

1. Abrir y activar la aplicación.
2. Localizar los controles de modelo y esfuerzo mediante Accesibilidad.
3. Leer la selección actual cuando la aplicación la exponga.
4. Cambiarla si no coincide con lo solicitado.
5. Volver a leerla y exigir una coincidencia normalizada exacta.
6. Crear la conversación nueva y recién entonces enviar el prompt.

Las diferencias de mayúsculas, espacios o tildes no invalidarán una coincidencia. Los nombres de familias o niveles distintos sí lo harán; por ejemplo, `Opus 5` no será equivalente a otro modelo de Claude y `Medio` no será equivalente a `Máx`.

Si un control no es accesible, un valor dejó de existir o una actualización cambió la interfaz, Olympus emitirá un estado `configuración requerida`. La pantalla indicará la aplicación, el modelo y el esfuerzo esperados, permitirá abrir la aplicación y ofrecerá **Volver a comprobar**. El prompt no se enviará hasta que el adaptador confirme ambos valores. La entrega final anterior permanecerá intacta.

Este diseño acepta que la automatización visual depende de las interfaces de Claude y ChatGPT. Los adaptadores estarán separados del coordinador del ciclo para poder actualizar selectores y reglas de lectura sin modificar el proceso académico.

## Ciclo de desarrollo y corrección

El ciclo Claude → ChatGPT → Claude conservará su comportamiento actual:

1. Olympus resuelve prompts y modelos efectivos.
2. Verifica Claude antes de iniciar el desarrollo.
3. Claude genera Word, Excel o ambos formatos seleccionados.
4. Olympus valida y extrae el contenido de todos los archivos.
5. Verifica ChatGPT antes de iniciar la corrección.
6. ChatGPT corrige el conjunto y termina con `CALIFICACIÓN: X/10`.
7. Si falta llegar a 10/10, Olympus vuelve a verificar Claude antes de enviar las correcciones.
8. Cuando ChatGPT otorga 10/10, Olympus publica atómicamente el conjunto final.

La verificación se repite al cambiar de aplicación porque el usuario puede modificar manualmente el modelo durante una ejecución. Cada corrida guardará una instantánea de los prompts, modelos, esfuerzos y formatos efectivos. No se almacenarán cookies, contraseñas ni sesiones de las aplicaciones.

## Informe técnico de estudio

El botón **Generar informe técnico** aparecerá habilitado cuando el TP tenga por lo menos una entrega final almacenada. Que exista una calificación 10/10 no iniciará el informe automáticamente: el usuario decide cuándo pulsar el botón.

Al preparar el informe, Olympus mostrará:

- los archivos de la entrega final que se usarán como base;
- los materiales académicos del TP;
- el prompt efectivo de informe y su origen;
- el modelo y esfuerzo efectivos de Claude;
- el logo general que se insertará.

El informe usará siempre formato Word (`.docx`) para que pueda editarse. El prompt que Olympus envía a Claude incluirá el contexto académico, el contenido de la entrega final, las instrucciones del informe y una exigencia explícita de insertar el logo adjunto dentro del documento. El logo se descargará temporalmente desde Drive y se adjuntará a la conversación nativa; el adaptador comprobará que la aplicación haya recibido el adjunto antes de enviar el texto.

ChatGPT no participará en este flujo. Olympus esperará un único `.docx`, comprobará que abra, que contenga texto extraíble y que el paquete Word incluya por lo menos una imagen incorporada. Sólo entonces lo publicará en:

`Olympus / Materia / TP / Informe técnico de estudio / Informe técnico final.docx`

La página del TP mostrará **Descargar** y **Abrir en Drive**. Si se genera otro informe, Olympus conservará el anterior hasta cargar y registrar correctamente el reemplazo; después eliminará el anterior. Sólo quedará vigente el último informe correcto. Un fallo del informe nunca borrará ni modificará la entrega final del TP.

## Preparación del contexto final

Las nuevas entregas finales conservarán el texto extraído de cada archivo junto con sus metadatos. Esto permitirá elaborar el informe sin depender de que Claude pueda interpretar nuevamente todos los archivos originales.

Para entregas creadas antes de esta mejora, Olympus descargará y extraerá el Word o Excel desde Drive al solicitar el primer informe. Si algún archivo antiguo no puede procesarse, el botón mostrará qué archivo requiere atención y no iniciará una generación incompleta.

La composición del contexto mantendrá esta prioridad:

1. Enunciado, consignas y rúbrica actuales.
2. Módulos teóricos.
3. Modelos anteriores y correcciones docentes.
4. Notas manuales.
5. Entrega final aprobada.
6. Prompt específico del informe.

Los modelos anteriores seguirán siendo referencias de criterio y presentación, no fuentes para copiar respuestas.

## Persistencia

Supabase incorporará una entidad de configuración del usuario protegida por RLS. Guardará prompts generales, modelos, esfuerzos y metadatos del logo. Las materias incorporarán prompt de informe y selecciones opcionales de modelos; los TP incorporarán los correspondientes valores de reemplazo.

El tipo de documento admitirá `study_report` además de `generated`. Los informes no se mezclarán con las entregas finales. Las ejecuciones registrarán su tipo (`assignment_cycle` o `study_report`) y una instantánea JSON de la configuración efectiva. Esto permitirá mostrar qué selección se usó sin alterar el historial cuando cambien las preferencias futuras.

La migración será aditiva. Los registros actuales conservarán sus identificadores, prompts, documentos, evaluaciones y carpetas. Las políticas RLS impedirán leer o modificar la configuración de otro usuario.

## Errores y recuperación

- Un modelo inexistente o no verificable bloquea el envío y muestra la selección esperada.
- Un cambio manual de modelo entre Claude y ChatGPT se detecta antes del siguiente paso.
- Un prompt efectivo vacío identifica el nivel donde debe configurarse.
- Un logo ausente bloquea solamente el informe; no bloquea el ciclo académico.
- Un adjunto de logo no confirmado no permite enviar el prompt del informe.
- Un Word faltante, corrupto, vacío o mayor de 40 MB no reemplaza el informe anterior.
- Un error de Drive deja disponible el archivo temporal para reintentar el guardado durante la sesión y conserva el informe anterior.
- Sólo puede existir una ejecución nativa activa. El informe y el ciclo académico usan el mismo bloqueo para evitar conversaciones o descargas cruzadas.

## Verificación y criterios de aceptación

La mejora se considerará completa cuando se compruebe lo siguiente:

- La configuración general guarda y resuelve los tres prompts, los modelos y los esfuerzos.
- Una materia puede usar modelos distintos de otra.
- Un TP puede conservar una selección propia sin cambiar la materia.
- Claude Opus 5 con esfuerzo Medio puede configurarse y Olympus impide comenzar si detecta otra selección.
- ChatGPT también se verifica antes de corregir.
- Los ciclos Word, Excel y Word + Excel existentes siguen llegando a 10/10 y publicándose de forma atómica.
- El logo se carga una vez, queda en Drive y se reutiliza en distintos TP.
- El botón de informe permanece deshabilitado sin entrega final y se habilita al existir una.
- Claude genera un único Word de informe con texto válido y una imagen incorporada para el logo.
- Regenerar el informe reemplaza el anterior sólo después de guardar correctamente el nuevo.
- Los documentos finales existentes continúan descargándose y pueden usarse como contexto.
- Pasan los tests unitarios de resolución de configuración, validación de modelos, publicación del informe y compatibilidad.
- Pasan lint, TypeScript, compilación web, pruebas nativas, firma de la aplicación y una prueba controlada completa con las aplicaciones instaladas.

## Fuera de alcance

- ChatGPT no corrige ni califica el informe técnico.
- Olympus no crea versiones PDF del informe.
- No se conservan borradores ni versiones históricas del informe.
- No se usan las API pagas de Anthropic u OpenAI.
- Olympus no asegura que una suscripción incluya un modelo que la aplicación no ofrezca; en ese caso informa que la selección no está disponible y no ejecuta el ciclo con otro modelo.
