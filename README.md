# SAE After Class

Sitio del evento y herramientas para administrar el torneo de FIFA: formulario de contacto, registro manual de participantes confirmados, sorteo de llaves y avance de resultados.

## Desarrollo local

La portada es estática y se puede abrir con cualquier servidor estático. Las rutas `/bracket` y `/admin`, además de las funciones de `/api`, requieren el despliegue en Vercel.

## Preparar el registro y las llaves

1. Importá este proyecto a Vercel.
2. Conectá una base Upstash Redis desde **Storage** del proyecto. Esto configura las variables de acceso que usan las funciones de API.
3. En **Settings → Environment Variables**, agregá `ADMIN_PASSWORD` con una contraseña privada.
4. Volvé a desplegar el proyecto.
5. Abrí `/admin` e ingresá la contraseña. Agregá manualmente a cada participante después de verificar su pago; el panel no guarda datos de pago.
6. Al llegar a 32 participantes confirmados, elegí **Realizar el sorteo**. La app mezcla los nombres y genera los 16 enfrentamientos. `/bracket` muestra las llaves públicamente.
7. Después de cada partido, seleccioná el ganador en el panel. El ganador avanza a la siguiente ronda. Si elegiste a la persona incorrecta, volvé a seleccionarla para deshacerlo.

La portada incluye un formulario que genera un mensaje para coordinar la inscripción y el pago. El equipo organizador confirma el pago y agrega el nombre del jugador al panel. El sorteo requiere los 32 cupos completos. No se recopilan carnet, carrera ni teléfonos en la base de datos del torneo.

Cuando tengas el número de WhatsApp de inscripciones, colocalo en `site-config.js` en formato internacional y solo con dígitos. El formulario abrirá WhatsApp con el mensaje preparado; cada jugador todavía debe confirmar el envío desde WhatsApp.

## Personalización

- Los textos y reglas del evento están en `index.html`.
- La contraseña del panel se define únicamente en las variables privadas del proyecto Vercel; no la guardés en el repositorio.
