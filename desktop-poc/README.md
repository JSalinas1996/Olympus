# Olympus Native Probe

Prueba técnica de detección de Claude y ChatGPT mediante Accesibilidad de macOS. No envía mensajes ni lee conversaciones.

```bash
make probe
```

El comando compila una pequeña utilidad nativa en Objective-C, la ejecuta y guarda
el resultado en `probe-report.json`. El informe solo contiene estado de permisos,
procesos, ventanas y etiquetas de controles editables; no incluye el contenido de
las conversaciones.

Si `accessibilityPermissionGranted` es `false`, la aplicación que ejecute Olympus deberá habilitarse en **Ajustes del Sistema → Privacidad y seguridad → Accesibilidad** antes de continuar con las pruebas de envío.

También incluye una aplicación de diagnóstico que permanece abierta y guía la
habilitación del permiso:

```bash
make app
open .build/Olympus.app
```

La aplicación detecta en tiempo real si Claude y ChatGPT están abiertos. Esta
etapa todavía no introduce texto ni pulsa el botón de envío.
