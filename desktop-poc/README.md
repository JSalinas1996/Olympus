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

1. Creá una materia. Olympus crea cuatro trabajos prácticos y su estructura dentro de `Olympus/<Materia>/` en Google Drive.
2. Entrá a un TP y completá la información, consignas, objetivo y los prompts de Claude y ChatGPT.
3. Subí los materiales desde esa misma pantalla. Se admiten PDF, Word, Excel, imágenes, escaneos y texto. Olympus los guarda en la sección correspondiente de Drive y extrae el contenido para las IA.
4. Elegí Word o Excel como formato final y pulsá **Iniciar Claude → ChatGPT → Claude**.
5. Claude crea un archivo; ChatGPT devuelve una corrección textual con calificación; Olympus envía los cambios a Claude hasta obtener `CALIFICACIÓN: 10/10` o completar tres rondas.
6. Sólo el archivo aprobado se guarda en `Olympus/<Materia>/<TP>/Entrega final`. Desde el TP se puede descargar el archivo o abrirlo en Drive.

Las versiones intermedias sólo existen en `~/Library/Application Support/Olympus Campus/Runs/` durante el ciclo. Se eliminan al publicar, cancelar o fallar. Si Drive no acepta una entrega ya aprobada, Olympus conserva temporalmente ese archivo y muestra **Reintentar guardado en Drive**.

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
