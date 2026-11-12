const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

fetch('/api/state')
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((state) => {
    const maximum = state.max || 32;
    const remaining = Math.max(0, maximum - state.playerCount);
    document.querySelector('#seats-count').textContent = `${remaining} / ${maximum}`;
    document.querySelector('#seat-progress').style.width = `${((maximum - remaining) / maximum) * 100}%`;
  })
  .catch(() => {});

menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

const form = document.querySelector('#signup-form');
const status = document.querySelector('#form-status');
const activitySelect = document.querySelector('#activity');
const sendButton = document.querySelector('#send-inscription');

function updateSendButton() {
  const activity = activitySelect.value;
  sendButton.disabled = !activity;
  if (activity.includes('FIFA') && activity.includes('Rey de la pista')) sendButton.firstChild.textContent = 'Abrir WhatsApp de ambos contactos ';
  else if (activity.includes('FIFA')) sendButton.firstChild.textContent = 'Ir a WhatsApp de FIFA ';
  else if (activity.includes('Mario Kart')) sendButton.firstChild.textContent = 'Ir a WhatsApp de Mario Kart ';
  else sendButton.firstChild.textContent = 'Elegí tu actividad ';
}
activitySelect.addEventListener('change', updateSendButton);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const message = [
    '¡Hola! Quiero inscribirme en SAE After Class 🎮',
    '',
    `Actividad: ${data.get('activity')}`,
    `Nombre: ${data.get('name').trim()}`,
    `Carnet: ${data.get('carnet').trim()}`,
    `Carrera: ${data.get('career').trim()}`,
    `Teléfono/WhatsApp: ${data.get('phone').trim()}`,
  ].join('\n');

  const contacts = window.SAE_EVENT_CONFIG?.inscriptionsWhatsApp || {};
  const activity = String(data.get('activity'));
  const recipients = [];
  if (activity.includes('FIFA')) recipients.push(['Contacto de FIFA', contacts.fifa]);
  if (activity.includes('Rey de la pista')) recipients.push(['Contacto de Mario Kart', contacts.marioKart]);
  const validRecipients = recipients.filter(([, number]) => String(number || '').replace(/\D/g, ''));
  if (validRecipients.length) {
    const urls = validRecipients.map(([, number]) => {
      const recipient = String(number).replace(/\D/g, '');
      return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    });
    status.textContent = 'Abriendo WhatsApp. Revisá el mensaje y tocá Enviar para completar la inscripción.';
    if (urls.length === 1) window.location.assign(urls[0]);
    else urls.forEach((url) => window.open(url, '_blank', 'noopener'));
  } else {
    status.textContent = 'No está configurado el contacto de WhatsApp para esa actividad.';
  }
  status.classList.remove('error');
});

updateSendButton();
