// ========================================================
// CLIENTE WEB MINIMALISTA - PULSERAS DE MACRAMÉ
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Modal y Vistas
  const reserveModal = document.getElementById('reserveModal');
  const openReserveBtn = document.getElementById('openReserveBtn');
  const closeReserveBtn = document.getElementById('closeReserveBtn');
  const openStatusBtn = document.getElementById('openStatusBtn');

  const formSection = document.getElementById('formSection');
  const statePendingView = document.getElementById('statePendingView');
  const stateAdmittedView = document.getElementById('stateAdmittedView');
  const stateRejectedView = document.getElementById('stateRejectedView');
  const checkStatusView = document.getElementById('checkStatusView');

  // Formulario de preguntas
  const quizForm = document.getElementById('quizForm');
  const nameInput = document.getElementById('userName');
  const emailInput = document.getElementById('userEmail');
  const emailError = document.getElementById('emailError');
  const btnSubmitQuiz = document.getElementById('btnSubmitQuiz');
  const interestSelect = document.getElementById('userInterest');
  const sourceSelect = document.getElementById('discoverySource');

  // Textos y elementos de estado
  const pendingMsgText = document.getElementById('pendingMsgText');
  const admittedMsgText = document.getElementById('admittedMsgText');
  const rejectedMsgText = document.getElementById('rejectedMsgText');
  const admittedHotmartBox = document.getElementById('admittedHotmartBox');
  const admittedHotmartLink = document.getElementById('admittedHotmartLink');
  const admittedHotmartWait = document.getElementById('admittedHotmartWait');

  const closePendingBtn = document.getElementById('closePendingBtn');
  const closeAdmittedBtn = document.getElementById('closeAdmittedBtn');
  const closeRejectedBtn = document.getElementById('closeRejectedBtn');

  // Consulta de estado
  const backToQuizBtn = document.getElementById('backToQuizBtn');
  const checkStatusForm = document.getElementById('checkStatusForm');
  const checkEmailInput = document.getElementById('checkEmail');
  const checkError = document.getElementById('checkError');
  const btnCheckSubmit = document.getElementById('btnCheckSubmit');

  // 1. Abrir Modal de Reserva
  openReserveBtn.addEventListener('click', () => {
    switchView('form');
    reserveModal.style.display = 'flex';
    emailInput.focus();
  });

  // Abrir Consulta de Estado
  openStatusBtn.addEventListener('click', () => {
    switchView('check');
    reserveModal.style.display = 'flex';
    checkEmailInput.focus();
  });

  // Cerrar Modal
  const closeModal = () => {
    reserveModal.style.display = 'none';
  };

  closeReserveBtn.addEventListener('click', closeModal);
  closePendingBtn.addEventListener('click', closeModal);
  closeAdmittedBtn.addEventListener('click', closeModal);
  closeRejectedBtn.addEventListener('click', closeModal);

  reserveModal.addEventListener('click', (e) => {
    if (e.target === reserveModal) closeModal();
  });

  backToQuizBtn.addEventListener('click', () => {
    switchView('form');
  });

  // 2. Envío del Formulario con Preguntas
  quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

    if (!emailRegex.test(email)) {
      emailError.textContent = 'Por favor, introduce un correo válido.';
      return;
    }

    // Obtener valor de la pregunta de 40€
    const willingRadio = document.querySelector('input[name="willingToPay40"]:checked');
    const willingToPay40 = willingRadio ? willingRadio.value : 'No especificado';
    const interest = interestSelect.value;
    const source = sourceSelect.value;

    setButtonLoading(btnSubmitQuiz, true, 'Enviando respuestas...');

    try {
      const response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          willingToPay40,
          interest,
          source
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const status = result.status || 'pendiente';
        const userName = (result.reservation && result.reservation.name) || (result.data && result.data.name) || name || 'alumno/a';
        const hotmartUrl = result.hotmartUrl || null;

        showStatusView(status, userName, email, hotmartUrl);
      } else {
        emailError.textContent = result.message || 'No se pudo procesar la solicitud.';
      }
    } catch (err) {
      console.error('Error al conectar:', err);
      emailError.textContent = 'Error de conexión con el servidor. Inténtalo de nuevo.';
    } finally {
      setButtonLoading(btnSubmitQuiz, false, 'Enviar Solicitud');
    }
  });

  // 3. Comprobar Estado por Email
  checkStatusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    checkError.textContent = '';
    const email = checkEmailInput.value.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      checkError.textContent = 'Introduce un correo válido.';
      return;
    }

    setButtonLoading(btnCheckSubmit, true, 'Verificando...');

    try {
      const res = await fetch(`/api/status?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.success && data.found) {
        const { status, name } = data.reservation;
        showStatusView(status, name, email, data.hotmartUrl);
      } else {
        checkError.textContent = 'No encontramos ninguna solicitud registrada con este correo. Puedes pulsar "Volver al formulario" para solicitar tu plaza.';
      }
    } catch (err) {
      checkError.textContent = 'Error al consultar. Inténtalo de nuevo.';
    } finally {
      setButtonLoading(btnCheckSubmit, false, 'Consultar Mi Estado');
    }
  });

  // Funciones de vista y estado
  function showStatusView(status, name, email, hotmartUrl) {
    hideAllViews();

    if (status === 'admitida') {
      admittedMsgText.innerHTML = `¡Felicidades <strong>${escapeHtml(name)}</strong>! El profesor ha evaluado tus respuestas y <strong>ha admitido tu plaza</strong> para <strong>${escapeHtml(email)}</strong>.`;
      
      if (hotmartUrl && hotmartUrl.trim() !== '') {
        admittedHotmartBox.style.display = 'block';
        admittedHotmartWait.style.display = 'none';
        admittedHotmartLink.href = hotmartUrl;
      } else {
        admittedHotmartBox.style.display = 'none';
        admittedHotmartWait.style.display = 'block';
      }

      stateAdmittedView.style.display = 'block';
    } else if (status === 'rechazada') {
      rejectedMsgText.innerHTML = `Hola <strong>${escapeHtml(name)}</strong>. Tras revisar tu solicitud asociada a <strong>${escapeHtml(email)}</strong>, lamentamos informarte de que no has podido ser admitido/a en esta edición debido al límite de plazas.`;
      stateRejectedView.style.display = 'block';
    } else {
      // Estado 'pendiente' (En espera de revisión)
      pendingMsgText.innerHTML = `¡Gracias <strong>${escapeHtml(name)}</strong>! Tu solicitud para <strong>${escapeHtml(email)}</strong> ha sido enviada con éxito. Por favor, <strong>mantente a la espera</strong> mientras el administrador revisa tus respuestas.`;
      statePendingView.style.display = 'block';
    }
  }

  function hideAllViews() {
    formSection.style.display = 'none';
    statePendingView.style.display = 'none';
    stateAdmittedView.style.display = 'none';
    stateRejectedView.style.display = 'none';
    checkStatusView.style.display = 'none';
  }

  function switchView(viewName) {
    hideAllViews();
    if (viewName === 'form') {
      formSection.style.display = 'block';
    } else if (viewName === 'check') {
      checkStatusView.style.display = 'block';
    }
  }

  function clearErrors() {
    emailError.textContent = '';
    checkError.textContent = '';
  }

  function setButtonLoading(btn, isLoading, text) {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<span>${text}</span>`;
    } else {
      btn.innerHTML = `<span>${text}</span> <span class="arrow">→</span>`;
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
