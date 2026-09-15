# Olympus Campus para macOS

Olympus Campus usa las sesiones ya iniciadas en las aplicaciones nativas de Claude y ChatGPT. No requiere créditos de API para el ciclo nativo.

## Instalación

```bash
make test
make install
open "$HOME/Applications/Olympus Campus.app"
```

La primera vez, habilitá **Olympus Campus** en **Ajustes del Sistema → Privacidad y seguridad → Accesibilidad**. Si se reemplaza el ejecutable por una compilación nueva y macOS sigue mostrando el permiso como pendiente, apagá y encendé una vez el interruptor de Olympus Campus. Claude y ChatGPT deben estar abiertos y con las suscripciones iniciadas.

La aplicación inicia el servidor local en `http://127.0.0.1:43127`. Sus registros quedan en `~/Library/Logs/Olympus Campus.log`.

## Uso

1. Entrá una vez a **Configuración**. Guardá los prompts generales de desarrollo, corrección e informe; elegí los modelos y niveles de esfuerzo; y cargá el logo general.
2. Creá una materia. Olympus crea cuatro trabajos prácticos y su estructura dentro de `Olympus/<Materia>/` en Google Drive. La materia hereda la configuración general y permite reemplazar cualquiera de esos valores.
3. Entrá a un TP y cargá sus archivos en uno de los tres grupos: **Enunciado + consignas + rúbrica**, **Módulos teóricos** o **Modelos anteriores**. Podés seleccionar varios archivos a la vez. Se admiten PDF, Word, Excel, imágenes, escaneos y texto; Olympus los guarda en la carpeta correspondiente de Drive y extrae el contenido para las IA.
4. Si subís un modelo anterior, escribí debajo las correcciones que hizo el docente. Olympus usa ese conjunto como criterio orientativo, sin copiar la respuesta. El enunciado y la rúbrica actuales siempre tienen prioridad.
5. En **Configuración del trabajo**, agregá notas manuales opcionales o definí excepciones de prompts y modelos sólo para ese TP.
6. Pulsá **Comprobar modelos**. Olympus selecciona y verifica en las aplicaciones nativas el modelo y el esfuerzo efectivos sin enviar un prompt.
7. Marcá Word, Excel o ambos según lo que pida el docente y pulsá **Iniciar Claude → ChatGPT → Claude**.
8. Claude crea todos los archivos seleccionados. ChatGPT corrige la entrega completa con una sola calificación y Olympus devuelve todos los cambios a Claude hasta obtener `CALIFICACIÓN: 10/10` o completar tres rondas.
9. Sólo el conjunto final aprobado se guarda en `Olympus/<Materia>/<TP>/Entrega final`. Desde el TP podés descargar cada archivo o abrirlo en Drive.
10. Cuando consideres cerrado el TP, pulsá **Generar informe técnico**. Claude recibe la entrega final, el contexto académico, tu prompt de informe y el logo. Olympus exige un Word editable con el logo incorporado y conserva únicamente el informe vigente en Drive.

Las versiones intermedias sólo existen en `~/Library/Application Support/Olympus Campus/Runs/` durante el ciclo. Se eliminan al publicar, cancelar o fallar. Si Drive no acepta una entrega ya aprobada, Olympus conserva temporalmente el conjunto y muestra **Reintentar guardado en Drive**. Dejá abiertas las aplicaciones nativas de Claude y ChatGPT, con tus suscripciones iniciadas, durante toda la ejecución. Como ambas aplicaciones pueden cambiar su interfaz, usá **Comprobar modelos** después de una actualización para detectar cualquier ajuste necesario antes de iniciar un trabajo.

## Verificación

```bash
cd ../web
npm test
npm run lint
npm run build
npm audit --omit=dev

cd ../desktop-poc
make test
make app
```

`make test` valida la extracción local de Word y Excel, incluidas las fórmulas, y el reconocimiento de calificaciones. `make app` compila y verifica la firma de la aplicación.

El comando opcional `make probe` genera `probe-report.json` con el estado de permisos, ventanas y controles editables. No incluye el contenido de las conversaciones.
