# Olympus: diseño de la aplicación académica

## Propósito

Olympus será una aplicación web privada para organizar las materias de la carrera de Contador Público y producir trabajos prácticos basados en material verificable. Claude actuará como alumno redactor y ChatGPT como catedrático evaluador dentro de un ciclo controlado. El usuario conservará el control sobre los prompts, las fuentes, las revisiones y la entrega final.

El sistema buscará maximizar el cumplimiento de la rúbrica, pero no prometerá una nota real. Una entrega se considerará lista cuando todos los criterios estén cubiertos con evidencia, no existan errores críticos conocidos y los cálculos hayan sido verificados.

## Alcance inicial

La aplicación será para un único usuario, estará alojada en internet y requerirá inicio de sesión. Admitirá trabajos jurídicos, contables, tributarios, matemáticos, estadísticos y de investigación.

Los archivos admitidos serán PDF, Word, imágenes y documentos escaneados. También se podrá ingresar texto directamente. El resultado principal será un archivo Word descargable.

## Organización de la información

La jerarquía principal será:

1. Materia.
2. Biblioteca y configuración propias de la materia.
3. Trabajos prácticos de la materia.
4. Versiones, evaluaciones, devoluciones y entrega de cada trabajo.

Cada materia tendrá:

- Nombre, estado, período y datos descriptivos.
- Fuentes generales: leyes, resoluciones técnicas, bibliografía y material de cátedra.
- Antecedentes de evaluación: trabajos anteriores, archivo separado con la corrección docente, nota, año y comentarios manuales del usuario.
- Un prompt configurable para Claude en rol de alumno.
- Un prompt configurable para ChatGPT en rol de catedrático.
- Lista de trabajos prácticos.

Cada trabajo práctico tendrá:

- Información del proyecto.
- Enunciado y situación problemática.
- Objetivo.
- Rúbrica de evaluación.
- Consignas.
- Archivos y texto específicos.
- Copias editables de los prompts heredados de la materia.
- Estado de procesamiento y ejecución.
- Versiones generadas, evaluaciones, fuentes y devoluciones del usuario.
- Documento Word final.

## Fuentes y antecedentes

Olympus distinguirá dos clases de material:

- Las fuentes de contenido respaldan afirmaciones: normativa, resoluciones, material de cátedra, bibliografía y fuentes web verificadas.
- Los antecedentes de evaluación ayudan a inferir estructura esperada, profundidad, errores frecuentes y criterios históricos del docente.

Los antecedentes no se tratarán como fundamentos jurídicos o teóricos y no se copiarán. La consigna y la rúbrica actuales siempre tendrán prioridad.

Las búsquedas web se limitarán a información pertinente y verificable. Las fuentes externas conservarán título, organismo o autor, URL, fecha de consulta y fragmento utilizado. Las fuentes oficiales y académicas tendrán prioridad. El sistema marcará la información insuficiente o contradictoria en lugar de inventar datos.

## Procesamiento documental

Al cargar un archivo, Olympus lo almacenará en Google Drive y creará un registro en la base de datos. Luego extraerá su texto, aplicará OCR si es necesario, separará el contenido en fragmentos citables y conservará la referencia al archivo y página de origen.

La base de datos contendrá el texto necesario para búsquedas por palabras y por significado. Los originales y archivos generados permanecerán en Drive. Toda recuperación de contenido se filtrará por materia y, cuando corresponda, por trabajo práctico para evitar cruces de contexto.

## Ciclo controlado entre las IA

El ciclo tendrá estas etapas persistentes:

1. Validar que existan consigna, objetivo, rúbrica y material mínimo.
2. Procesar documentos y detectar información faltante.
3. Recuperar las evidencias relevantes y, si está permitido, investigar fuentes web.
4. Ejecutar cálculos con herramientas deterministas cuando el trabajo lo requiera.
5. Pedir a Claude que produzca el borrador en rol de alumno.
6. Pedir a ChatGPT que evalúe el borrador criterio por criterio en rol de catedrático.
7. Verificar citas, fuentes, cálculos y observaciones críticas.
8. Enviar a Claude las correcciones concretas y generar una nueva versión.
9. Repetir hasta cumplir la condición de cierre o una condición de detención segura.
10. Generar el Word final y el informe de evaluación.

El límite inicial será de cinco rondas Claude–ChatGPT, configurable por trabajo. El proceso se detendrá si alcanza el límite, repite los mismos problemas, requiere información no verificable o necesita una decisión del usuario.

El usuario podrá pausar, reanudar o cancelar una ejecución; aprobar una versión; regresar a una versión anterior; pedir cambios en lenguaje natural; y generar el Word cuando lo considere adecuado. Cada devolución manual producirá una nueva versión sin eliminar las anteriores y podrá enviarse nuevamente al ciclo de evaluación.

## Condición de cierre

Una versión podrá marcarse como lista cuando:

- Todos los criterios de la rúbrica estén cubiertos y justificados.
- Las afirmaciones relevantes tengan una fuente identificable.
- Los cálculos hayan pasado controles automáticos.
- ChatGPT no señale errores críticos pendientes.
- No existan conflictos de fuentes sin informar al usuario.

La calificación mostrada será una estimación razonada, no una garantía de la nota docente.

## Interfaz

La página de inicio mostrará todas las materias y permitirá alternar entre cuadrícula y lista. Incluirá búsqueda por materia, trabajo y contenido, además de filtros por estado, período y trabajos pendientes. Cada materia mostrará indicadores de fuentes, antecedentes y ejecuciones activas o listas para descargar.

La vista de materia incluirá resumen, fuentes y teoría, antecedentes corregidos, prompts de IA, trabajos prácticos y configuración. La vista de trabajo mostrará los datos de entrada, estado del ciclo, versiones, evaluación por rúbrica, fuentes utilizadas, devoluciones del usuario y descarga final.

## Arquitectura técnica

- Aplicación web: Next.js con TypeScript, desplegada en Netlify.
- Autenticación: Supabase Auth, restringida al único usuario autorizado.
- Base de datos: PostgreSQL de Supabase para materias, trabajos, rúbricas, fragmentos, índices, ejecuciones, versiones y estados.
- Archivos: una carpeta privada de Google Drive autorizada mediante OAuth 2.0.
- Alumno: Anthropic API con el prompt de Claude configurado para la materia o trabajo.
- Catedrático: OpenAI API con el prompt configurado para la materia o trabajo.
- Procesamiento: extracción de PDF y Word, OCR de imágenes y documentos escaneados, segmentación e indexación.
- Exportación: creación de DOCX con estructura académica, citas, bibliografía, tablas, fórmulas e imágenes según el trabajo.

Las cargas de archivos irán directamente a Drive para evitar los límites de carga de las funciones. Las operaciones largas se dividirán en etapas idempotentes ejecutadas en segundo plano. Cada etapa guardará su salida antes de iniciar la siguiente, lo que permitirá reintentar un fallo sin duplicar versiones ni reiniciar todo el proceso.

## Seguridad y privacidad

Las claves de OpenAI y Anthropic, el secreto de Supabase y las credenciales renovables de Google permanecerán en variables o almacenamiento cifrado del servidor. Nunca se enviarán al navegador ni se incluirán en el repositorio.

La base aplicará reglas de acceso al único usuario autorizado. Los archivos de Drive permanecerán privados. Los registros evitarán almacenar secretos y permitirán auditar llamadas, fuentes, costos estimados y errores.

## Costos y límites

El alojamiento podrá comenzar en planes gratuitos de Netlify y Supabase, y los archivos utilizarán la cuota disponible en la cuenta de Google Drive. El consumo de OpenAI, Anthropic y cualquier servicio externo de OCR se cobrará por separado.

Antes de iniciar un ciclo, la aplicación mostrará una estimación de consumo. Se podrán configurar límites por trabajo y detener nuevas rondas cuando se alcance el máximo permitido.

## Manejo de errores

- Un archivo ilegible quedará marcado con una explicación y opción de volver a procesarlo.
- Una fuente web inaccesible o no verificable no respaldará afirmaciones.
- Un error temporal de una API se reintentará con espera progresiva.
- Un error definitivo dejará el trabajo pausado en la última etapa completa.
- Las respuestas inválidas de los modelos se rechazarán y repetirán con formato estructurado.
- Los cambios concurrentes se protegerán mediante estados y claves de idempotencia.
- El usuario verá qué falló, qué se conservó y qué acción puede tomar.

## Verificación y pruebas

Las pruebas unitarias cubrirán permisos, reglas de cierre, cálculo de estados, validación de respuestas y generación de referencias. Las pruebas de integración comprobarán Drive, Supabase y los adaptadores de IA usando entornos o respuestas controladas.

Los recorridos completos verificarán creación de una materia, carga y extracción de cada tipo de archivo, creación de un trabajo, ciclo de revisión, devolución manual, recuperación ante fallos y exportación a Word. Se comprobará de manera específica que un trabajo nunca recupere documentos de otra materia y que toda cita generada apunte a una evidencia existente.

## Entrega por etapas

1. Base web, autenticación, materias, búsqueda y navegación.
2. Trabajos prácticos, rúbricas, prompts y antecedentes.
3. Integración con Google Drive y procesamiento documental.
4. Integración con Claude y ChatGPT mediante el ciclo persistente.
5. Fuentes web verificadas, cálculos y controles contra invenciones.
6. Devoluciones manuales, historial y exportación a Word.
7. Seguridad, límites de costo, pruebas completas y despliegue.

