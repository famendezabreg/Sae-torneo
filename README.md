# SAE After Class

Sitio del evento y herramientas para administrar el torneo de FIFA: formulario de contacto, registro de jugadores con código, sorteo de llaves y avance de resultados.

## Desarrollo local

La portada es estática y se puede abrir con cualquier servidor estático. Las rutas `/join`, `/bracket` y `/admin`, además de las funciones de `/api`, requieren el despliegue en Vercel.

## Preparar el registro y las llaves

1. Importá este proyecto a Vercel.
2. Conectá una base Upstash Redis desde **Storage** del proyecto. Esto configura las variables de acceso que usan las funciones de API.
3. En **Settings → Environment Variables**, agregá `ADMIN_PASSWORD` con una contraseña privada.
4. Volvé a desplegar el proyecto.
5. Abrí `/admin`, ingresá la contraseña y elegí **Reiniciar todo (códigos nuevos)**. Confirmá escribiendo `RESTART`; el panel generará 32 códigos nuevos. Copialos y compartilos solo con jugadores cuyo pago haya sido confirmado.
6. Los jugadores usan `/join` para canjear un código y elegir el nombre que aparecerá en las llaves. `/bracket` muestra el estado público.
7. El día del evento, abrí `/admin` para sortear y registrar a quienes ganen cada partido.

La portada incluye un formulario que genera un mensaje para coordinar la inscripción y el pago. La confirmación del pago y la entrega de códigos quedan a cargo de la persona organizadora. No se recopilan carnet, carrera ni teléfonos en la base de datos del torneo.

## Personalización

- Los nombres disponibles para el sorteo están en `api/_config.js` (`NAMES`, mínimo 32).
- Los textos y reglas del evento están en `index.html`.
- La contraseña del panel se define únicamente en las variables privadas del proyecto Vercel; no la guardés en el repositorio.
