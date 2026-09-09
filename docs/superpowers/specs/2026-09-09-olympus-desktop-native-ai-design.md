# Olympus Desktop con Claude y ChatGPT nativos

## Objetivo

Convertir Olympus en una aplicación local para macOS que coordine automáticamente las aplicaciones nativas de Claude y ChatGPT mediante las suscripciones personales ya iniciadas. La integración usará Accesibilidad de macOS y automatización de interfaz, porque las suscripciones no ofrecen acceso programático oficial.

## Alcance inicial

La primera entrega será una prueba técnica. Deberá detectar ambas aplicaciones, enviar y recuperar mensajes identificados y completar una ronda Claude → ChatGPT → Claude. La migración completa continuará solamente si la prueba resulta repetible.

## Arquitectura

Olympus se empaquetará como aplicación para macOS y reutilizará la interfaz actual. Tendrá tres partes independientes:

- Interfaz y coordinador persistente del ciclo.
- Base SQLite cifrada y carpeta local de documentos.
- Adaptadores de automatización para Claude y ChatGPT.

La primera versión será exclusiva para macOS. No ejecutará trabajos con la computadora bloqueada ni ofrecerá automatización remota.

### Almacenamiento

SQLite guardará materias, trabajos, prompts, rúbricas, fragmentos, ejecuciones, versiones, evaluaciones, devoluciones y estados de recuperación. Los archivos permanecerán en una carpeta local administrada por Olympus. Google Drive para escritorio podrá sincronizarla como respaldo. Supabase podrá mantenerse para una futura vista remota, pero no será una dependencia del motor local.

### Adaptadores nativos

Cada adaptador deberá comprobar que su aplicación esté abierta y autenticada, localizar o crear la conversación asignada, activar la ventana correcta, introducir un mensaje, detectar la finalización y recuperar la última respuesta completa.

Se usarán primero controles semánticos de Accesibilidad de macOS. No se dependerá de coordenadas fijas. El reconocimiento visual solo se evaluará si un control imprescindible no es accesible y puede verificarse de forma confiable.

## Flujo automático

1. El usuario carga materia, documentos, consigna, objetivo, rúbrica, antecedentes y prompts.
2. Olympus extrae el texto y selecciona la evidencia pertinente.
3. El coordinador prepara para Claude un paquete con un identificador único.
4. Claude produce el trabajo y Olympus recupera, valida y guarda una versión inmutable.
5. Olympus prepara para ChatGPT el trabajo, la rúbrica y la evidencia.
6. ChatGPT devuelve puntaje, errores y cambios solicitados.
7. Olympus convierte la evaluación en instrucciones y las devuelve a Claude.
8. El ciclo se repite hasta cumplir el criterio o alcanzar el límite.
9. El usuario puede intervenir, pausar, corregir o aprobar cualquier versión.
10. Olympus genera el Word y conserva toda la trazabilidad.

## Control y recuperación

El coordinador usará estados persistentes: preparado, enviando, esperando, validando, revisando, pausado, bloqueado, listo y cancelado. Cada transición se guardará antes de la siguiente acción externa. Al reiniciarse, Olympus retomará el último estado confirmado sin duplicar mensajes.

Antes de cada envío validará la aplicación activa, la conversación esperada y el identificador del trabajo. Si falla una comprobación, pausará el ciclo.

## Ventanas, portapapeles y privacidad

Olympus podrá usar el portapapeles para contenidos largos, pero restaurará su contenido anterior después de cada operación. Durante un ciclo mostrará que controla temporalmente teclado y ventanas. La intervención manual pausará la ejecución.

Olympus no almacenará contraseñas, cookies ni credenciales de Claude o ChatGPT. La autenticación permanecerá dentro de las aplicaciones oficiales. Los registros técnicos no incluirán datos de sesión ni el contenido completo del portapapeles.

## Manejo de errores

El ciclo se pausará si una aplicación está cerrada, falta una sesión, aparece una verificación o límite, no se identifica la conversación, vence el tiempo de respuesta, el resultado está incompleto, cambia la interfaz, se bloquea la Mac o se pierde el permiso de Accesibilidad. Olympus nunca continuará suponiendo qué aparece en pantalla.

## Prueba técnica

### Nivel 1: detección

Detectar Claude y ChatGPT, enumerar sus ventanas accesibles y localizar el campo de conversación sin enviar información.

### Nivel 2: ida y vuelta independiente

Enviar a cada aplicación un mensaje inocuo con un identificador aleatorio, esperar la respuesta, recuperarla y comprobar el identificador.

### Nivel 3: ciclo coordinado

Enviar una tarea pequeña a Claude, pasar el resultado a ChatGPT para evaluarlo, devolver una corrección a Claude y guardar las tres respuestas con estados y marcas de tiempo.

La prueba se aprobará solo si los tres niveles se repiten sin coordenadas fijas. Si los controles semánticos son insuficientes, se documentará el resultado antes de decidir entre reconocimiento visual o modo asistido.

## Criterios de aceptación

- Detecta ambas aplicaciones sin almacenar credenciales.
- Envía y recupera mensajes identificados.
- Distingue una respuesta en curso de una finalizada.
- Preserva el portapapeles.
- Se pausa ante una interfaz inesperada o intervención manual.
- Completa y registra una ronda Claude → ChatGPT → Claude.
- Retoma una ejecución sin duplicar mensajes confirmados.

## Limitaciones

Esta integración automatiza interfaces y no es una API oficial. Depende de la estructura de accesibilidad y de los límites de uso de las aplicaciones. No funciona con la Mac bloqueada y una actualización puede exigir mantener los adaptadores. Por eso la prueba técnica es obligatoria antes de migrar toda la aplicación.
