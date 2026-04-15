# Demo End-to-End - Cierre de Sprint

Fecha: 2026-04-15

## Objetivo
Validar el flujo completo: login -> elegir duracion -> publicar -> ver en galeria API.

## Precondiciones
- Backend configurado con `.env` valido.
- PostgreSQL disponible y migraciones aplicadas.
- R2 configurado para subida y verificacion de objetos.
- Frontend servido en `http://localhost:5500`.

## Arranque local
1. Backend:

```bash
cd backend
npm install
npm run dev
```

2. Frontend (desde la raiz del repo):

```bash
py -3 -m http.server 5500
```

3. Abrir en navegador:

```text
http://localhost:5500/index.html
```

## Flujo demo manual
1. En landing, iniciar sesion con Google.
2. Ir a "Empezar a Dibujar".
3. Elegir una duracion disponible (1, 5, 10, 15).
4. Dibujar algo rapido y pulsar "Compartir".
5. Confirmar firma (anonima o con nombre).
6. Verificar mensaje de resultado:
- Exito esperado: "Publicada en la nube y confirmada en backend."
7. Ir a galeria y comprobar que aparece la obra del dia.
8. Abrir "Mis dibujos de hoy" y confirmar que la obra publicada aparece.

## Verificacion por API
Con backend levantado:

```bash
cd backend
npm run test:smoke
npm run test:integration:http
npm run test:smoke:demo
```

Resultado esperado:
- Smoke en verde.
- Integracion HTTP en verde.
- Demo smoke end-to-end en verde, incluyendo caso negativo de finalize-upload.

## Evidencia minima de cierre
- Captura de pantalla de login exitoso.
- Captura de pantalla de publicacion exitosa.
- Captura de pantalla de galeria mostrando la obra.
- Salida de consola de `npm run test:smoke:demo` en verde.
