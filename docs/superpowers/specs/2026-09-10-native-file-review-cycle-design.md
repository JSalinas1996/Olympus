# Ciclo nativo de revisión de archivos

## Objetivo

Olympus debe coordinar las aplicaciones nativas de Claude y ChatGPT usando las suscripciones abiertas del usuario. Claude genera la entrega como archivo Word o Excel. ChatGPT devuelve una corrección en texto. Olympus repite el intercambio hasta que ChatGPT otorgue 10/10 o se alcance el máximo de rondas. Sólo la versión final aprobada se conserva en Google Drive.

## Alcance

El ciclo admite archivos `.docx` y `.xlsx`. El formato lo determina el prompt de Claude y debe conservarse durante todas las revisiones. Las versiones intermedias se guardan únicamente en un directorio temporal administrado por Olympus y se eliminan cuando el ciclo termina, se cancela o falla.

La versión final se sube a la carpeta `Olympus/<Materia>/<TP>/Entrega final` de Google Drive. También queda disponible para descargar y abrir desde la pantalla del trabajo práctico.

## Flujo

1. Olympus valida que Claude, ChatGPT y Google Drive estén disponibles, que existan los prompts necesarios y que la carpeta temporal esté preparada.
2. Olympus abre una conversación nueva y aislada en Claude. El prompt exige una entrega completa en `.docx` o `.xlsx` y un único archivo de salida.
3. Olympus detecta el archivo generado por Claude y lo copia a su directorio temporal. No toma archivos anteriores ni archivos cuyo formato no coincida con el pedido.
4. Olympus extrae una representación verificable del archivo:
   - Word: párrafos, títulos, tablas, notas y propiedades relevantes.
   - Excel: hojas, celdas con valores, fórmulas, tablas y estructura básica.
5. Olympus abre una conversación nueva y aislada en ChatGPT y envía la representación del archivo junto con consignas, rúbrica, fuentes procesadas y prompt docente.
6. ChatGPT devuelve una corrección textual, enumera cambios concretos y cierra con `CALIFICACIÓN: X/10`.
7. Si la calificación es inferior a 10/10, Olympus vuelve a Claude con el archivo de la ronda anterior y la corrección completa. Claude debe generar un archivo nuevo que sustituya conceptualmente a la versión anterior.
8. Al obtener 10/10, Olympus sube sólo el último archivo a Drive, registra la evaluación final y elimina los archivos intermedios.
9. La interfaz presenta el archivo aprobado, su formato, la calificación, la corrección final y acciones para descargarlo o abrirlo en Drive.

## Componentes

### Coordinador nativo

Controla las rondas, crea conversaciones separadas, envía prompts, espera respuestas y mantiene el estado del ciclo. Nunca usa atajos ciegos: si no puede confirmar una conversación nueva o el campo correcto, detiene la ejecución.

### Monitor de archivos

Toma una instantánea del directorio de descargas antes de cada pedido a Claude y acepta únicamente archivos nuevos creados después del inicio de la ronda. Espera a que el tamaño y la fecha del archivo se estabilicen antes de copiarlo. Rechaza extensiones inesperadas, archivos vacíos y nombres duplicados ambiguos.

### Extractor

Produce texto estructurado para la corrección sin alterar el archivo original. Para Excel incluye fórmulas y valores disponibles, de modo que ChatGPT pueda revisar tanto los resultados como el procedimiento.

### Almacenamiento temporal

Cada ejecución usa una carpeta identificada por trabajo y ejecución. Las versiones reciben números de ronda. Ningún archivo intermedio se sube a Drive. La limpieza se ejecuta al completar, cancelar o fallar el ciclo.

### Publicador final

Sube la última versión aprobada a la carpeta `Entrega final`, guarda su identificador y enlace de Drive en Supabase y permite reemplazar una entrega final anterior sólo cuando exista una nueva versión aprobada.

## Estados y errores

La interfaz muestra la etapa actual: preparando, esperando a Claude, archivo recibido, corrigiendo con ChatGPT, revisando con Claude, aprobado, detenido o fallido.

El ciclo se detiene sin publicar cuando:

- no puede confirmar un chat nuevo;
- Claude no genera exactamente un archivo compatible;
- el archivo no termina de descargarse;
- la extracción falla;
- ChatGPT no devuelve una calificación reconocible;
- una aplicación deja de responder;
- se alcanza el máximo de rondas sin 10/10.

Olympus conserva el último error y la última corrección textual para diagnóstico, pero elimina los archivos temporales al cerrar la ejecución. Una publicación fallida mantiene el archivo final temporal hasta permitir un reintento explícito de la carga a Drive.

## Seguridad de los datos

Los archivos se procesan localmente. Las versiones intermedias no se envían a Drive ni se registran como adjuntos permanentes en Supabase. Olympus no escribe en conversaciones existentes y no interpreta contenido de documentos como instrucciones para controlar las aplicaciones. Los prompts delimitan el contenido académico y la instrucción del sistema de revisión.

## Interfaz

La sección del ciclo incluye:

- selector de formato esperado: Word o Excel;
- botón para iniciar o cancelar;
- etapa y número de ronda;
- nombre del archivo detectado;
- corrección textual más reciente;
- calificación;
- al finalizar, botones `Descargar archivo final` y `Abrir en Drive`.

El historial permanente muestra sólo la ejecución aprobada, la evaluación final y el enlace al archivo final.

## Verificación

Las pruebas unitarias cubren detección de archivos nuevos, estabilización de descargas, selección por extensión, extracción de Word y Excel, reconocimiento de calificaciones y limpieza temporal.

Las pruebas de integración cubren la API de resultados, la publicación única en Drive y el reemplazo seguro de una entrega final anterior.

La prueba manual de aceptación usa un Word y un Excel pequeños. En ambos casos debe demostrarse que Claude genera el archivo inicial, ChatGPT devuelve texto, Claude genera una revisión cuando corresponde, sólo el archivo 10/10 aparece en Drive y puede descargarse desde Olympus.

