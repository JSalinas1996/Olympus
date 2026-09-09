# Plan de implementación de Olympus

## Objetivo

Construir una aplicación privada desplegable en Netlify que organice materias y trabajos prácticos, almacene archivos en Google Drive, use Supabase para autenticación y datos, coordine Claude y ChatGPT en un ciclo persistente y exporte la entrega a Word.

## Etapa 1: base web y navegación

1. Crear una aplicación Next.js con TypeScript y configuración para Netlify.
2. Definir el sistema visual, el layout adaptable y los componentes compartidos.
3. Implementar inicio, vista en cuadrícula/lista, búsqueda y filtros.
4. Implementar las vistas de materia y trabajo práctico con datos demostrativos tipados.
5. Añadir estados vacíos, de carga y de error.
6. Validar compilación, accesibilidad básica y navegación responsive.

## Etapa 2: modelo de datos y acceso privado

1. Configurar cliente y servidor de Supabase mediante variables de entorno.
2. Crear migraciones para perfiles autorizados, materias, trabajos, rúbricas, documentos, antecedentes, fragmentos, ejecuciones, versiones, evaluaciones, devoluciones y fuentes web.
3. Aplicar Row Level Security a todas las tablas del usuario.
4. Implementar autenticación por correo y contraseña con una lista permitida.
5. Reemplazar los datos demostrativos por consultas y mutaciones reales.
6. Probar aislamiento, permisos y persistencia.

## Etapa 3: Google Drive y documentos

1. Implementar OAuth 2.0 del lado servidor y guardar el token renovable cifrado.
2. Crear o seleccionar la carpeta privada de Olympus.
3. Implementar cargas reanudables directas y metadatos en Supabase.
4. Extraer texto de PDF y DOCX; detectar archivos que necesitan OCR.
5. Implementar OCR para imágenes y documentos escaneados.
6. Dividir el texto en fragmentos, conservar páginas y crear índices de búsqueda.
7. Probar carga, descarga, reintentos y separación entre materias.

## Etapa 4: adaptadores de IA

1. Crear adaptadores independientes para Anthropic y OpenAI con respuestas estructuradas.
2. Definir contratos para borrador, evaluación por rúbrica, observaciones y uso de fuentes.
3. Aplicar los prompts heredados de la materia y las modificaciones del trabajo.
4. Registrar modelo, consumo, costo estimado, duración y errores sin guardar secretos.
5. Validar que toda cita devuelta corresponda a una evidencia entregada al modelo.

## Etapa 5: orquestación persistente

1. Implementar la máquina de estados de preparación, validación, desarrollo, evaluación, revisión, bloqueo y cierre.
2. Ejecutar una etapa por tarea en segundo plano con claves de idempotencia.
3. Guardar cada resultado antes de activar la etapa siguiente.
4. Implementar reintentos, pausa, reanudación, cancelación y límite configurable de rondas.
5. Detectar observaciones repetidas y faltantes que requieran intervención humana.
6. Mostrar el progreso y el historial en tiempo real mediante consultas periódicas seguras.

## Etapa 6: fuentes web y herramientas de cálculo

1. Implementar búsqueda restringida a fuentes pertinentes y trazables.
2. Registrar URL, título, organismo o autor, fecha y fragmento citado.
3. Incorporar un ejecutor aislado para cálculos contables, matemáticos y estadísticos.
4. Guardar entradas, fórmulas, resultados y validaciones.
5. Rechazar fuentes inaccesibles y resultados no reproducibles.

## Etapa 7: devolución y exportación

1. Implementar devoluciones manuales sobre cualquier versión.
2. Generar nuevas versiones sin sobrescribir el historial.
3. Crear documentos DOCX con estilos, tablas, fórmulas, imágenes, citas y bibliografía.
4. Guardar el Word en Drive y ofrecer su descarga autenticada.
5. Incluir una matriz de cumplimiento de la rúbrica y un informe de fuentes.

## Etapa 8: seguridad, calidad y despliegue

1. Validar archivos, tamaños, tipos MIME y contenido recibido.
2. Añadir límites de uso, estimaciones y protección ante ciclos excesivos.
3. Ejecutar pruebas unitarias, de integración y recorridos completos.
4. Configurar variables seguras en Netlify y Supabase.
5. Desplegar una versión privada en Netlify.
6. Conectar el dominio generado, verificar login, Drive, IA y exportación.

## Dependencias externas necesarias

- Proyecto de Supabase y credenciales web.
- Proyecto de Google Cloud con Drive API y OAuth configurados.
- Clave de Anthropic API con saldo disponible.
- Clave de OpenAI API con facturación activa.
- Cuenta de Netlify conectada al repositorio de GitHub.

La aplicación podrá desarrollarse y probarse con adaptadores locales antes de recibir estas credenciales. Las integraciones reales se habilitarán cuando estén disponibles.
