# The Daily Scribble

Espacio creativo diario para dibujar en tiempo limitado, firmar tu obra (si quieres) y verla caer en una galería local con física.

## Resumen

The Daily Scribble es una app web estática enfocada en el hábito creativo:

- Cada día aparece una palabra distinta.
- El usuario elige una duración (1, 5, 10 o 15 minutos).
- Dibuja en canvas con herramientas básicas.
- Comparte su resultado en la galería del día.

La versión actual funciona como MVP sin backend, con persistencia local por fecha.

## Objetivo del proyecto

- Fomentar la práctica diaria de dibujo sin fricción.
- Crear una experiencia efímera: todo se renueva al cambiar de día.
- Mantener una base simple para iteración rápida y escalarla progresivamente con backend real.

## Funcionalidades principales

- Palabra diaria generada de forma determinística por fecha.
- Flujo por vistas:
  - Landing
  - Galería
  - Preparación de sesión
  - Lienzo de dibujo
- Temporizador por sesión con opciones de:
  - 1 minuto
  - 5 minutos
  - 10 minutos
  - 15 minutos
- Herramientas de dibujo:
  - Pincel
  - Borrador
  - Línea
  - Rectángulo
  - Círculo
  - Bote de pintura (flood fill)
  - Gotero
- Paleta predefinida + selector de color personalizado.
- Control de trazo (grosor).
- Historial con deshacer y rehacer.
- Descarga del dibujo en PNG.
- Firma opcional al compartir.
- Galería con física usando Matter.js.
- Persistencia diaria en localStorage.

## Flujo de uso

1. Entrar a la landing.
2. Ir a "Empezar a Dibujar".
3. Ver la palabra del día.
4. Elegir duración.
5. Dibujar hasta que se termine el tiempo o finalizar manualmente.
6. Compartir anónimo o con firma.
7. Ver el resultado en la galería del día.

## Decisiones técnicas alineadas al plan de trabajo

- Arquitectura MVP estática:
  - Sin servidor ni base de datos.
  - Base rápida para validar experiencia y UX.
- Estado efímero diario:
  - Se guarda con una clave de día (formato YYYY-MM-DD).
  - Cuando cambia la fecha, se limpia el estado previo.
- Firma aplicada en exportación:
  - La firma se integra al PNG final para evitar "estampados" repetidos durante el dibujo.

## Próxima fase técnica (proyecto en desarrollo)

Para completar el producto, estas son las capacidades que se recomienda incorporar después del MVP:

- Backend API para galería global real (no solo local).
- Base de datos para guardar obras, autores, palabras diarias e historial.
- Autenticación de usuarios (cuenta, perfil, obras públicas/privadas).
- Almacenamiento de imágenes en cloud (S3, Cloudinary o similar).
- Moderación de contenido y reportes.
- Métricas de uso y analítica de producto.
- Funciones sociales: likes, comentarios, rankings o retos semanales.

## Estructura del proyecto

- `index.html`: estructura de vistas, paneles y modales.
- `style.css`: diseño visual, layout responsivo y componentes.
- `app.js`: estado global, canvas, herramientas, timer, persistencia y galería.

## Tecnologías

- HTML5
- CSS3
- JavaScript Vanilla
- Canvas API
- Matter.js (CDN)

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari).
- No requiere instalación de dependencias.

## Ejecución local

1. Clona el repositorio:

```bash
git clone https://github.com/Harry-GNS/Scrible.git
cd Scrible
```

2. Opción rápida: abre `index.html` en tu navegador.

3. Opción recomendada (servidor local):

```bash
python -m http.server 5500
```

4. Abre:

```text
http://localhost:5500
```

## Backend

Se agregó una base de backend independiente en `backend/` con Node.js, TypeScript, lint y formato.

### Arranque rápido

1. Entra a la carpeta del backend:

```bash
cd backend
```

2. Instala dependencias:

```bash
npm install
```

3. Copia `.env.example` a `.env` y ajusta el puerto si hace falta.

4. Inicia en desarrollo:

```bash
npm run dev
```

5. Verifica la salud:

```text
GET /health
```

### Regla diaria UTC (MVP)

Se agregó una primera version de regla por dia en UTC para permitir solo 1 intento por duracion para cada usuario.

- Duraciones permitidas: `1`, `5`, `10`, `15` minutos.
- Clave de dia: `YYYY-MM-DD` en UTC.
- Estado actual: almacenamiento en memoria (reinicia al reiniciar el server).

Endpoints:

```text
GET /drawing/eligibility?userId=USER_ID&duration=5
POST /drawing/claim
```

Body de `POST /drawing/claim`:

```json
{
  "userId": "google-user-id-o-uuid",
  "duration": 5
}
```

Si el usuario ya uso esa duracion en el mismo dia UTC, devuelve `409`.

### Registro con Google (MVP)

No necesitas crear contrasena local en la app. El usuario entra con su cuenta de Google y el backend valida el token.

1. Crea un OAuth Client ID de tipo Web en Google Cloud.
2. En backend, define `GOOGLE_CLIENT_ID` en `.env`.
3. Recarga la pagina y usa el boton de Google en la landing.

Endpoint usado por frontend:

```text
POST /auth/google
```

## Persistencia y datos

- Se utiliza localStorage para guardar:
  - Día actual.
  - Palabra diaria.
  - Galería por duración.
- Los datos viven en el navegador del usuario (no se envían a un servidor).
- Al iniciar un nuevo día, la experiencia se reinicia automáticamente.

### Estado actual

- Persistencia 100% local con localStorage.

### Evolución recomendada

- Migrar a persistencia híbrida:
  - localStorage para estado rápido de sesión.
  - backend + base de datos para galería compartida y cuentas.
- Mantener la lógica "diaria" también en servidor para consistencia global.

## APIs y frameworks recomendados para terminar el proyecto

### Opción recomendada (equilibrio entre velocidad y escalabilidad)

- Frontend:
  - React + Vite
  - Mantener Canvas API y Matter.js
- Backend:
  - Node.js + NestJS (o Express si prefieren algo más simple)
  - API REST para obras, usuarios, comentarios y palabras diarias
- Base de datos:
  - PostgreSQL
  - ORM: Prisma
- Autenticación:
  - JWT + refresh tokens
  - OAuth opcional (Google)
- Almacenamiento de imágenes:
  - AWS S3 o Cloudinary
- Tiempo real (si quieren interacción social viva):
  - Socket.IO para likes/comentarios en vivo

### APIs externas útiles

- Cloudinary API o S3 SDK: subir y servir imágenes.
- API de moderación de imágenes (Google Vision o AWS Rekognition): filtrar contenido.
- Sentry API: monitoreo de errores de frontend y backend.
- PostHog o Plausible: analítica de producto.

## Atajos

- `Ctrl + Z` / `Cmd + Z`: deshacer.
- `Ctrl + Y` / `Cmd + Y`: rehacer.

## Nota de estado

Este proyecto aún está en desarrollo. Por eso, este README se enfoca en el estado actual del MVP y en la hoja de ruta técnica para terminarlo, sin documentar un despliegue final de dominio por ahora.

## Roadmap sugerido

- Exportar también en JPEG/WebP.
- Más herramientas (texto, formas rellenas, capas simples).
- Tema visual por palabra diaria.
- Sincronización en nube para una galería compartida real.
- Sistema de usuarios y perfiles.
- Feed global con descubrimiento de obras por tags o palabra del día.
- Retos diarios/semanales con dinámicas comunitarias.

## Autoría

Creado por Harry y EPN.
