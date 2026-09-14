# Olympus: expediente único y entregas Word/Excel

## Problema

La pantalla actual obliga a copiar por separado el objetivo, el enunciado, las consignas y la rúbrica. En la práctica, esa información suele llegar reunida en uno o varios archivos. Además, el ciclo permite elegir Word o Excel, aunque algunos trabajos exigen ambos archivos como una sola entrega.

El nuevo flujo debe aceptar el material tal como lo entrega la universidad, conservar el propósito de cada archivo y evaluar conjuntamente todos los entregables solicitados.

## Experiencia aprobada

La página del TP comienza con tres áreas de carga, cada una compatible con selección múltiple:

1. **Enunciado + consignas + rúbrica**: documentos que definen qué debe resolverse y cómo será evaluado. Tienen la máxima prioridad ante cualquier contradicción.
2. **Módulos teóricos**: bibliografía, normativa y material de cátedra que fundamentan el desarrollo.
3. **Modelos anteriores**: trabajos resueltos y correcciones de otros años. Orientan sobre estructura y criterios docentes, pero no reemplazan las consignas actuales ni autorizan copiar contenido.

Los cinco cuadros separados de información del proyecto, situación problemática, objetivo, consignas y rúbrica dejan de ocupar el área principal. Se reemplazan por un único campo persistente y plegable de **Notas manuales opcionales**. Para ello se agrega `manual_notes text not null default ''` a `assignments`. Los prompts de Claude y ChatGPT permanecen editables en otra sección plegable y siguen heredando el valor general de la materia cuando no existe una personalización del TP.

Cada archivo muestra nombre, estado de procesamiento, enlace a Drive, reintento y eliminación. Los modelos anteriores incluyen además un campo persistente **Correcciones que hizo el docente**, con guardado explícito por archivo.

La selección de entrega usa dos casillas independientes:

- Word (`.docx`)
- Excel (`.xlsx`)

Debe seleccionarse al menos una. Si se seleccionan ambas, Olympus considera Word y Excel una única entrega y sólo publica el conjunto cuando ChatGPT otorga 10/10 al par completo.

## Carga y clasificación

La interfaz enviará los archivos de una selección uno por uno para evitar que el límite total de una solicitud impida subir un lote grande. Cada archivo conserva el límite actual de 40 MB y los formatos admitidos: PDF, DOC, DOCX, XLSX, PNG, JPG, JPEG, HEIC, TIF, TIFF, TXT y CSV.

Un componente cliente mostrará la cola de carga y el resultado individual. El fallo de un archivo no cancela los que ya se cargaron ni los restantes. Al completar el lote, la página se actualiza y muestra el estado de extracción de cada documento.

Las categorías reutilizan los tipos existentes de la base de datos:

- Enunciado + consignas + rúbrica → `assignment`
- Módulos teóricos → `source`
- Modelos anteriores → `precedent_work`

Los documentos existentes de tipo `rubric` se muestran junto al expediente principal y los de tipo `precedent_correction` junto a los modelos, de modo que los datos actuales sigan siendo utilizables.

Se agrega `teacher_feedback text not null default ''` a `documents`. Sólo se muestra y edita para modelos anteriores. El texto se incorpora inmediatamente después del contenido extraído de su modelo dentro del contexto enviado a ambas IA.

## Contexto académico para las IA

Olympus construye el contexto con bloques explícitos y ordenados:

1. Identificación de materia y TP.
2. Enunciado + consignas + rúbrica.
3. Módulos teóricos.
4. Modelos anteriores, cada uno acompañado por las correcciones escritas del docente.
5. Notas manuales e indicaciones adicionales del alumno.

El prompt general indica que el primer bloque manda ante contradicciones, que los módulos son fuentes de fundamento y que los modelos sólo aportan criterios de presentación o corrección. Los archivos sin texto reconocido permanecen visibles, pero bloquean el inicio si son parte del expediente principal hasta que se reprocesen o eliminen. Un TP puede iniciar cuando los prompts están completos y existe al menos un documento procesado o una nota manual.

## Ciclo con uno o dos entregables

El navegador nativo envía un arreglo `formats` con `docx`, `xlsx` o ambos. El coordinador valida que no esté vacío, crea una conversación nueva en Claude y le exige exactamente un archivo por formato seleccionado.

En cada ronda:

1. Olympus registra el estado de Descargas y la cantidad de botones de descarga por formato.
2. Claude genera todos los archivos solicitados.
3. Olympus descarga y copia cada archivo al directorio privado de la ronda.
4. Olympus verifica que cada archivo abra y extrae su contenido.
5. ChatGPT recibe el contexto académico y secciones separadas con el contenido del Word y del Excel. Debe comprobar completitud, cálculos, coherencia entre archivos, afirmaciones y citas.
6. ChatGPT emite una única calificación para el conjunto.
7. Si la calificación es menor a 10, Claude recibe toda la corrección y debe reemplazar el conjunto completo en la ronda siguiente.

El ciclo mantiene el máximo actual de tres rondas. La ausencia, duplicación o corrupción de cualquiera de los formatos seleccionados detiene la ronda sin publicar una entrega incompleta.

## Publicación de la entrega final

El resultado nativo cambia de un único archivo a un arreglo `files`, donde cada elemento contiene nombre, MIME y contenido codificado. La aplicación envía todos los archivos aprobados en una sola operación de publicación.

El servidor valida:

- que ChatGPT haya terminado con `CALIFICACIÓN: 10/10`;
- que exista exactamente un archivo por formato seleccionado;
- que cada extensión y MIME coincidan;
- que cada archivo tenga contenido y no supere 40 MB.

El almacenamiento crea primero todo el nuevo conjunto en la carpeta **Entrega final** de Drive. Sólo después de confirmar archivos y registros elimina la entrega final anterior. Ante un fallo durante la preparación, elimina los nuevos archivos parciales y conserva la entrega anterior.

Supabase registra una ejecución, una versión cuyo contenido contiene el arreglo completo de archivos y una evaluación común. La página muestra cada archivo final con botones independientes **Descargar** y **Abrir en Drive**. Repetir el ciclo reemplaza el conjunto anterior, por lo que Olympus conserva únicamente la última entrega aprobada.

## Errores y recuperación

- Cada error de carga identifica el archivo afectado y permite reintentar ese archivo.
- Un documento principal sin texto reconocido impide iniciar el ciclo y explica qué debe reprocesarse.
- Si Claude no genera todos los formatos, Olympus indica cuáles faltan y no envía una entrega parcial a ChatGPT.
- Si ChatGPT no otorga 10/10 después de tres rondas, no se publica ningún archivo nuevo.
- Si Drive falla después de la aprobación, el conjunto permanece en el directorio privado de Olympus y aparece **Reintentar guardado en Drive**.
- Los límites temporales de las aplicaciones nativas se informan sin perder la entrega final anterior.

## Compatibilidad

Las materias, TP, prompts, documentos y entregas ya existentes continúan disponibles. Los campos estructurados actuales permanecen en la base para compatibilidad y siguen formando parte del contexto de las IA. Si contienen datos, la nueva pantalla los muestra en un bloque plegable de sólo lectura llamado **Información anterior**; no los copia, modifica ni mezcla con las nuevas Notas manuales. Las entregas antiguas de un solo archivo se muestran como un conjunto de un elemento.

La estructura existente de Drive no se borra. Las cargas nuevas usan tres carpetas visibles dentro de cada TP: **01 - Enunciado, consignas y rúbrica**, **02 - Módulos teóricos** y **03 - Modelos anteriores**. Las carpetas anteriores siguen siendo legibles para no mover ni eliminar archivos del usuario.

## Verificación y criterios de aceptación

La implementación se considera terminada cuando se compruebe lo siguiente:

- Se pueden seleccionar y subir varios archivos en cada una de las tres categorías.
- Un PDF combinado con objetivo, consignas, preguntas y rúbrica llega completo al prompt de Claude y al de ChatGPT.
- Las correcciones escritas para un modelo se guardan, vuelven a aparecer al recargar y se incluyen en el contexto.
- Puede ejecutarse un ciclo sólo Word y otro sólo Excel.
- Puede ejecutarse un ciclo Word + Excel; ChatGPT recibe ambos contenidos y una única evaluación.
- La publicación conjunta nunca deja visible sólo uno de los dos archivos solicitados.
- Una nueva entrega aprobada reemplaza el conjunto anterior en Supabase y Drive.
- Los botones de descarga nativa guardan correctamente cada archivo en Descargas.
- Los tests unitarios del validador, almacenamiento y coordinador nativo pasan, junto con lint, TypeScript, compilación web y firma de la aplicación macOS.

## Fuera de alcance

Olympus no intentará dividir automáticamente un archivo combinado en campos estructurados ni inferir por sí solo qué formatos pidió el docente. El usuario clasifica el material en una de las tres áreas y selecciona Word, Excel o ambos antes de iniciar; esto evita decisiones automáticas incorrectas.
