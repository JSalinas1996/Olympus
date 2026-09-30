# Plan de implementación: familias automáticas y razonamiento por ejecución

## Objetivo

Evitar que Olympus se bloquee cuando Claude o ChatGPT incrementan la versión visible de un modelo, y permitir elegir el nivel de razonamiento para una ejecución sin cambiar la configuración persistida.

## 1. Preferencias estables en la web

Archivos principales:

- `web/src/lib/ai/model-options.ts`
- `web/src/lib/ai/model-options.test.ts`
- `web/src/lib/ai/settings.ts`
- `web/src/lib/ai/settings.test.ts`
- `web/src/components/ai-model-fields.tsx`

Cambios:

1. Definir identificadores canónicos de familia para Claude y ChatGPT.
2. Traducir valores históricos versionados a su familia estable.
3. Mantener los valores desconocidos en modo exacto.
4. Cambiar los valores iniciales de esfuerzo a `high` cuando no exista configuración guardada.
5. Mostrar las familias como “última versión disponible”.
6. Cubrir normalización, compatibilidad histórica, modo exacto y herencia con tests unitarios.

## 2. Selección temporal de esfuerzo

Archivos principales:

- `web/src/components/native-cycle.tsx`
- `web/src/components/study-report.tsx`

Cambios:

1. Añadir selectores locales de esfuerzo para Claude y ChatGPT en el ciclo académico.
2. Añadir selector local de Claude para el informe técnico.
3. Inicializarlos con la configuración efectiva y no persistir sus cambios.
4. Enviar los valores temporales al puente nativo y conservarlos durante todas las rondas.
5. Guardar la selección solicitada y la selección resuelta en la instantánea final.

## 3. Resolución nativa de familias

Archivos principales:

- `desktop-poc/App/AIModelController.h`
- `desktop-poc/App/AIModelController.m`
- `desktop-poc/App/CycleCoordinator.m`
- `desktop-poc/App/StudyReportCoordinator.m`
- `desktop-poc/App/main.m`
- `desktop-poc/Tests/FileCycleTests.m`

Cambios:

1. Separar coincidencia exacta de coincidencia por familia.
2. Leer las opciones del menú y elegir la mayor versión numérica de la familia.
3. Ignorar multiplicadores, precios y otros números ajenos al nombre del modelo.
4. Comprobar el esfuerzo después de seleccionar el modelo.
5. Devolver el nombre y esfuerzo realmente seleccionados al coordinador y a la web.
6. Mantener errores explícitos sin cambiar de familia.
7. Probar orden de versiones, aislamiento de familias, compatibilidad y modelos exactos.

## 4. Estado y persistencia de la ejecución

Archivos principales:

- `web/src/components/native-cycle.tsx`
- `web/src/components/study-report.tsx`
- rutas de publicación de entrega e informe, sólo si requieren ampliar la instantánea.

Cambios:

1. Mostrar durante la ejecución el modelo real comprobado.
2. Incorporar solicitado/resuelto en `configuration_snapshot`.
3. Mantener la entrega final anterior hasta publicar correctamente la nueva.
4. Confirmar que una ejecución posterior a 10/10 pueda comenzar con otro esfuerzo.

## 5. Verificación y entrega local

1. Ejecutar tests web específicos y completos.
2. Ejecutar lint y compilación de producción.
3. Ejecutar tests y compilación nativos.
4. Instalar la aplicación actualizada.
5. Probar el selector real con Claude y ChatGPT instalados, hasta donde permitan las sesiones iniciadas.
6. Confirmar que la configuración histórica `Opus 5` resuelva la versión Opus actual.
7. Revisar el diff para evitar incluir cambios de Drive ajenos en el commit de esta mejora.
