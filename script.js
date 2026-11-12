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

form.addEventListener('submit', async (event) => {
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

  let output = form.querySelector('.generated-message');
  if (!output) {
    output = document.createElement('div');
    output.className = 'generated-message';
    output.setAttribute('role', 'status');
    form.append(output);
  }
  output.textContent = message;

  form.querySelectorAll('.copy-button,.whatsapp-button').forEach((button) => button.remove());
  const contacts = window.SAE_EVENT_CONFIG?.inscriptionsWhatsApp || {};
  const activity = String(data.get('activity'));
  const recipients = [];
  if (activity.includes('FIFA')) recipients.push(['Contacto de FIFA', contacts.fifa]);
  if (activity.includes('Mario Kart')) recipients.push(['Contacto de Mario Kart', contacts.marioKart]);
  const validRecipients = recipients.filter(([, number]) => String(number || '').replace(/\D/g, ''));
  if (validRecipients.length) {
    validRecipients.forEach(([label, number]) => {
      const whatsappLink = document.createElement('a');
      const recipient = String(number).replace(/\D/g, '');
      whatsappLink.className = 'button button-lime whatsapp-button';
      whatsappLink.href = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
      whatsappLink.target = '_blank';
      whatsappLink.rel = 'noopener';
      whatsappLink.textContent = `${label}: abrir WhatsApp ↗`;
      form.append(whatsappLink);
    });
    status.textContent = 'Abrí el chat del contacto correspondiente, revisá el mensaje y tocá Enviar.';
  } else {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-button';
    copy.textContent = 'Copiar mensaje';
    form.append(copy);
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(message);
        copy.textContent = '¡Mensaje copiado!';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(output);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copy.textContent = 'Seleccionado: copiá el texto';
      }
    };
    status.textContent = 'El WhatsApp de inscripciones aún está pendiente. Por ahora, copiá el mensaje para enviarlo.';
  }
  status.classList.remove('error');
});
