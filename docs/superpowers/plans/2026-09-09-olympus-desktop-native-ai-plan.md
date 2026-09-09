# Plan de implementación de Olympus Desktop

## Fase 1: prueba de accesibilidad

1. Crear una herramienta nativa de diagnóstico para macOS.
2. Detectar Claude y ChatGPT por sus identificadores de aplicación.
3. Comprobar el permiso de Accesibilidad sin solicitarlo automáticamente.
4. Enumerar ventanas y controles editables sin leer conversaciones.
5. Guardar un informe local sin contenido privado.

## Fase 2: adaptadores de mensajes

1. Definir una interfaz común para ambos adaptadores.
2. Activar la aplicación y conversación correctas.
3. Preservar el portapapeles, introducir un mensaje identificado y enviarlo.
4. Detectar generación en curso y finalización.
5. Recuperar la respuesta y validar el identificador.
6. Pausar ante verificaciones, límites o interfaces desconocidas.

## Fase 3: prueba coordinada

1. Persistir una ejecución pequeña en SQLite.
2. Ejecutar Claude → ChatGPT → Claude.
3. Comprobar que cada respuesta corresponde a la ejecución.
4. Probar pausa, recuperación y prevención de duplicados.

## Fase 4: aplicación de escritorio

1. Empaquetar la interfaz existente para macOS.
2. Incorporar SQLite cifrada y almacenamiento documental local.
3. Integrar los adaptadores con la máquina de estados.
4. Añadir permisos, diagnóstico y recuperación visibles.
5. Implementar materias, trabajos, devoluciones y exportación Word.

## Condición de avance

No se automatizarán trabajos reales hasta que la prueba coordinada funcione de forma repetible sin coordenadas fijas. Cada fase debe dejar un resultado ejecutable y verificable.
