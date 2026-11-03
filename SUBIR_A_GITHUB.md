# Publicar Cubemine en tu GitHub

El juego está preparado para GitHub Pages. Esta entrega aún no crea un repositorio ni publica nada en tu cuenta.

Los números, las banderas y las minas se dibujan sobre la superficie de sus casillas. Al girar el cubo, cada símbolo gira dentro del plano de la cara para mantener la vertical de lectura y se estrecha con la perspectiva. Las pistas `{n}`, `-n-` y los totales de línea siguen la misma regla. Se han superado las 47 comprobaciones automáticas. La revisión visual y las pruebas con ratón y pantalla táctil siguen pendientes porque el servicio de previsualización no estaba disponible.

1. Descomprime el ZIP y abre la carpeta `cubemine`, donde están `README.md`, `package.json`, `dist`, `scripts`, `tests` y `.github`.
2. En tu cuenta de GitHub, crea un repositorio llamado `cubemine`, por ejemplo. Un repositorio público permite usar Pages con el plan gratuito. Créalo vacío, sin añadir otro README.
3. Sube **el contenido** de la carpeta extraída a la raíz del repositorio. No subas el ZIP ni una carpeta adicional que envuelva todos los archivos. Incluye `.github/workflows/pages.yml`; puede estar oculta en tu explorador de archivos.
4. En el repositorio, entra en **Settings → Pages**. En **Build and deployment → Source**, selecciona **GitHub Actions**.
5. Abre **Actions → Test and deploy Cubemine → Run workflow** y elige `main`. Los cambios posteriores en esa rama se publicarán automáticamente si pasan las comprobaciones.
6. Al terminar, copia la dirección que aparece en **Settings → Pages**. Normalmente tendrá este formato: `https://TU-USUARIO.github.io/cubemine/`. Sustituye `TU-USUARIO` por tu cuenta real; no es una dirección ya creada.

Si subes los archivos desde la web y falta la carpeta `.github`, usa **Add file → Create new file**, escribe `.github/workflows/pages.yml` como nombre y pega el contenido completo del archivo incluido en el ZIP. Guarda el cambio en `main`.

## Subir con Git

Desde la carpeta extraída que contiene `package.json`, después de crear un repositorio vacío:

```bash
git init -b main
git add .
git commit -m "Añadir prototipo Cubemine"
git remote add origin https://github.com/TU-USUARIO/cubemine.git
git push -u origin main
```

Usa tu nombre de usuario real y la autenticación habitual de GitHub. Después configura Pages como se indica arriba. El flujo de publicación no necesita que añadas tokens ni claves a los archivos.

## Probar antes de publicar

Con Node.js 24 o posterior:

```bash
npm run check
npm test
npm start
```

Abre `http://127.0.0.1:8080/`. No hay dependencias que instalar ni proceso de compilación. Para simular la ruta de Pages, usa `npm start -- --base-path /cubemine/` y abre `http://127.0.0.1:8080/cubemine/`.

El español sigue siendo el idioma predeterminado y se puede cambiar a inglés. Se conservan el modo aleatorio y los 12 puzles fijos. El progreso se guarda por dominio en el navegador: las partidas de otra dirección no se transfieren automáticamente.

El sitio publicado contiene solamente `dist/`. Los documentos internos del diseño no forman parte de este paquete para el repositorio. Consulta `README.md` para solucionar problemas y `TECHNICAL_NOTES.md` para los detalles del juego.
