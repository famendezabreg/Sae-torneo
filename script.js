const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

fetch('/api/state')
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((state) => {
    const maximum = state.max || 32;
    const remaining = Math.max(0, maximum - state.players.length);
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

  let copy = form.querySelector('.copy-button');
  if (!copy) {
    copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-button';
    form.append(copy);
  }
  copy.textContent = 'Copiar mensaje';
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
  status.textContent = 'Mensaje listo. Copialo y envialo al contacto de inscripciones (pendiente de publicar).';
  status.classList.remove('error');
});
