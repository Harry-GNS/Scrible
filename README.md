# The Daily Scribble

Aplicación web creativa para dibujar con tiempo limitado, firmar la obra y compartirla en una galería diaria local.

## Demo local

1. Clona el repositorio:

```bash
git clone https://github.com/Harry-GNS/Scrible.git
cd Scrible
```

2. Abre `index.html` directamente en tu navegador.

Opcional (recomendado): usar un servidor local para desarrollo.

Con VS Code puedes usar Live Server, o con Python:

```bash
python -m http.server 5500
```

Luego abre:

http://localhost:5500

## Funcionalidades

- Palabra diaria automática basada en fecha.
- Temporizador de dibujo (1, 5, 10, 15 minutos).
- Herramientas de dibujo:
  - Pincel
  - Borrador
  - Línea
  - Rectángulo
  - Círculo
  - Bote de pintura
  - Gotero
- Historial con deshacer/rehacer.
- Descarga del dibujo en PNG.
- Firma opcional al compartir.
- Galería local con física (Matter.js).
- Estado diario persistido en localStorage.

## Estructura

- `index.html`: estructura de vistas y modales.
- `style.css`: estilos y diseño responsivo.
- `app.js`: lógica de interacción, dibujo, timer y galería.

## Tecnologías

- HTML5
- CSS3
- JavaScript (Vanilla)
- Canvas API
- Matter.js (CDN)

## Notas de persistencia

La galería y el estado diario se guardan en el navegador usando localStorage con clave diaria. Al cambiar de día, el estado se reinicia.

## Publicación en GitHub Pages

Como es un proyecto estático, puedes publicarlo en GitHub Pages:

1. Ve al repositorio en GitHub.
2. Entra a Settings > Pages.
3. En Build and deployment selecciona:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
4. Guarda y espera unos minutos.

## Autoría

Creado por Harry & EPN.
