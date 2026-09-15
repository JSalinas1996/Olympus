# Plan de implementación: modelos, prompts e informe técnico

## Objetivo

Incorporar configuración general, selección heredable de modelos y esfuerzos, control previo de las aplicaciones nativas y generación manual de un informe técnico Word con logo, sin alterar las entregas finales actuales.

## 1. Persistencia y compatibilidad

Archivos:

- `web/supabase/migrations/202609150001_ai_settings_and_study_reports.sql`
- `web/src/lib/ai/settings.ts`
- `web/src/lib/ai/settings.test.ts`

Pasos:

1. Crear `user_ai_settings` con prompts generales, modelos, esfuerzos y metadatos del logo, protegida por RLS.
2. Añadir a `subjects` el prompt de informe y las excepciones de modelo/esfuerzo.
3. Añadir a `assignments` el prompt de informe y las excepciones de modelo/esfuerzo.
4. Extender `document_kind` con `study_report`.
5. Añadir a `ai_runs` el tipo de ejecución y la instantánea de configuración efectiva.
6. Implementar un resolvedor puro TP → materia → general y probar herencia, espacios vacíos y origen de cada valor.
7. Mantener los prompts existentes de cada materia como excepciones válidas.

## 2. Catálogo y contratos de modelos

Archivos:

- `web/src/lib/ai/model-options.ts`
- `web/src/lib/ai/contracts.ts`
- `web/src/lib/ai/model-options.test.ts`

Pasos:

1. Definir el contrato `{ provider, model, effort }` que viajará al puente nativo.
2. Crear opciones conocidas para Claude y ChatGPT, incluyendo Claude Opus 5 y esfuerzo Medio.
3. Admitir un modelo personalizado con nombre visible exacto.
4. Validar valores y normalizar sólo espacios, mayúsculas y tildes; no equiparar familias distintas.

## 3. Logo general y almacenamiento en Drive

Archivos:

- `web/src/lib/drive/storage.ts`
- `web/src/app/api/settings/logo/route.ts`
- `web/src/app/api/settings/logo/download/route.ts`
- pruebas unitarias del almacenamiento extraídas a funciones puras cuando corresponda

Pasos:

1. Crear bajo `Olympus` las carpetas `Configuración/Logo` cuando se necesiten.
2. Validar PNG/JPEG y límite de 10 MB.
3. Cargar primero el logo nuevo, registrar metadatos y eliminar después el anterior.
4. Permitir descarga autenticada, apertura en Drive y eliminación.
5. No modificar las carpetas ni documentos de materias existentes.

## 4. Pantalla de configuración general

Archivos:

- `web/src/app/configuracion/page.tsx`
- `web/src/app/configuracion/actions.ts`
- `web/src/components/ai-model-fields.tsx`
- `web/src/components/logo-settings.tsx`
- `web/src/components/dashboard.tsx`

Pasos:

1. Añadir acceso visible a Configuración desde el inicio.
2. Crear formularios para los tres prompts y los modelos/esfuerzos predeterminados.
3. Mostrar selector conocido, opción personalizada y errores de validación en español.
4. Incorporar la carga nativa del logo mediante el selector de archivos ya habilitado.
5. Mostrar el logo vigente y sus acciones.

## 5. Excepciones por materia y TP

Archivos:

- `web/src/app/materias/nueva/page.tsx`
- `web/src/app/materias/nueva/actions.ts`
- `web/src/app/materias/[subjectId]/page.tsx`
- `web/src/app/materias/[subjectId]/actions.ts`
- `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`
- `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/actions.ts`

Pasos:

1. Hacer que una materia nueva herede la configuración general salvo excepción explícita.
2. Incorporar edición de prompts, modelos y esfuerzos en la materia.
3. Incorporar prompt de informe y modelos en la configuración del TP.
4. Mostrar valor efectivo y origen sin copiar valores heredados a la base.
5. Guardar una selección hecha en el TP como excepción persistente.

## 6. Contexto y publicación del informe

Archivos:

- `web/src/lib/study-report.ts`
- `web/src/lib/study-report.test.ts`
- `web/src/app/api/assignments/[assignmentId]/study-report/context/route.ts`
- `web/src/app/api/assignments/[assignmentId]/study-report/route.ts`
- `web/src/lib/drive/storage.ts`
- `web/src/app/api/documents/[documentId]/download/route.ts`

Pasos:

1. Construir el contexto del informe con materiales, notas y entrega final.
2. Extraer bajo demanda el contenido de entregas antiguas que no tengan texto almacenado.
3. Entregar al cliente el logo en base64 únicamente al iniciar el informe.
4. Validar el Word recibido: extensión, MIME, límite de 40 MB, texto extraíble e imagen incorporada.
5. Publicar en `Informe técnico de estudio` con reemplazo atómico.
6. Registrar la corrida y su instantánea de configuración.
7. Permitir descargar tanto `generated` como `study_report` desde el endpoint autenticado.

## 7. Control nativo de modelos

Archivos:

- `desktop-poc/App/AIModelController.h`
- `desktop-poc/App/AIModelController.m`
- `desktop-poc/App/AIApplication.h`
- `desktop-poc/App/AIApplication.m`
- `desktop-poc/App/CycleCoordinator.m`
- `desktop-poc/App/main.m`
- `desktop-poc/Makefile`
- `desktop-poc/Tests/FileCycleTests.m`

Pasos:

1. Separar el descubrimiento, selección y verificación de modelo/esfuerzo del envío de prompts.
2. Preparar Claude antes de desarrollar y revisar la selección cada vez que el ciclo vuelva a Claude.
3. Preparar ChatGPT antes de cada corrección.
4. Emitir `olympus-model-configuration-required` con aplicación y selección esperada cuando no haya coincidencia.
5. Incorporar la acción `retry-model-check` sin reiniciar ni perder el estado de la ejecución.
6. Añadir pruebas de normalización, coincidencia exacta y estados de error.

## 8. Coordinador nativo del informe

Archivos:

- `desktop-poc/App/StudyReportCoordinator.h`
- `desktop-poc/App/StudyReportCoordinator.m`
- `desktop-poc/App/AIApplication.h`
- `desktop-poc/App/AIApplication.m`
- `desktop-poc/App/main.m`
- `desktop-poc/Makefile`

Pasos:

1. Crear una ejecución Claude independiente del ciclo de corrección.
2. Materializar el logo base64 en el directorio privado de la corrida.
3. Adjuntar y comprobar el logo en Claude antes de enviar el prompt.
4. Exigir un único Word, descargarlo, abrirlo y extraer texto.
5. Comprobar que el paquete Word contenga una imagen.
6. Emitir progreso, resultado, cancelación y guardado pendiente con eventos propios.
7. Reutilizar el bloqueo global para impedir que un informe y un ciclo se crucen.

## 9. Interfaz del informe y preflight

Archivos:

- `web/src/components/native-cycle.tsx`
- `web/src/components/study-report.tsx`
- `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`

Pasos:

1. Mostrar el resumen efectivo de modelos, esfuerzos, prompts y formatos.
2. Manejar la pausa y el botón Volver a comprobar cuando el modelo no coincide.
3. Habilitar Generar informe técnico sólo con entrega final, prompt y logo disponibles.
4. Mostrar los insumos, iniciar Claude y publicar el Word recibido.
5. Mostrar el informe vigente con Descargar y Abrir en Drive.
6. Mantener el reintento de Drive sin perder el archivo temporal.

## 10. Validación integral y entrega

Pasos:

1. Ejecutar los tests web existentes y nuevos.
2. Ejecutar lint y compilación de producción según la versión local de Next.js.
3. Compilar y ejecutar `FileCycleTests` nativos.
4. Reconstruir, firmar e instalar `Olympus Campus.app`.
5. Aplicar la migración al proyecto Supabase configurado.
6. Probar en la aplicación instalada: herencia de configuración, selección de Claude Opus 5 Medio, selección de ChatGPT, ciclo Word/Excel, carga de logo e informe Word.
7. Comprobar que un error conserva entregas e informes anteriores.
8. Actualizar README con la secuencia de uso.
9. Revisar secretos, `git diff`, firma y estado del repositorio.
10. Crear commits enfocados y sincronizar `main` con GitHub.
