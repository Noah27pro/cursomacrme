// ========================================================
// CONTROLADOR DEL PANEL DE ADMISIONES - MACRAMÉ STUDIO
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado local
  let reservationsList = [];
  let currentTab = 'all';

  // DOM
  const tableBody = document.getElementById('reservationsTableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDesc = document.getElementById('emptyDesc');

  const searchInput = document.getElementById('searchInput');
  const tableCounter = document.getElementById('tableCounter');

  // Métricas
  const metricTotal = document.getElementById('metricTotal');
  const metricPending = document.getElementById('metricPending');
  const metricAdmitted = document.getElementById('metricAdmitted');
  const metricRejected = document.getElementById('metricRejected');

  // Badges de pestañas
  const badgeAll = document.getElementById('badgeAll');
  const badgePending = document.getElementById('badgePending');
  const badgeAdmitted = document.getElementById('badgeAdmitted');
  const badgeRejected = document.getElementById('badgeRejected');
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Configuración Hotmart
  const configForm = document.getElementById('configForm');
  const hotmartUrlInput = document.getElementById('hotmartUrl');
  const courseStatusSelect = document.getElementById('courseStatus');
  const discountInput = document.getElementById('discountPercentage');
  const testHotmartLink = document.getElementById('testHotmartLink');
  const configSavedAlert = document.getElementById('configSavedAlert');

  // Modal ver respuestas
  const viewQuizModal = document.getElementById('viewQuizModal');
  const quizModalContent = document.getElementById('quizModalContent');
  const quizModalFooter = document.getElementById('quizModalFooter');
  const closeQuizModalBtn = document.getElementById('closeQuizModalBtn');

  // Modal manual
  const addModal = document.getElementById('addModal');
  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const closeAddModalBtn = document.getElementById('closeAddModalBtn');
  const cancelAddModalBtn = document.getElementById('cancelAddModalBtn');
  const addManualForm = document.getElementById('addManualForm');
  const manualName = document.getElementById('manualName');
  const manualEmail = document.getElementById('manualEmail');
  const manualPay = document.getElementById('manualPay');
  const manualStatus = document.getElementById('manualStatus');
  const modalError = document.getElementById('modalError');

  const refreshBtn = document.getElementById('refreshBtn');

  // Carga inicial
  loadConfig();
  loadReservations();

  // 1. Cargar todas las solicitudes
  async function loadReservations() {
    try {
      const res = await fetch('/api/reservations');
      const data = await res.json();

      if (data.success) {
        reservationsList = data.reservations || [];
        updateMetrics(data);
        renderTable();
      }
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
      showToast('Error al conectar con la base de datos.', 'danger');
    }
  }

  function updateMetrics(data) {
    const total = data.total || reservationsList.length;
    const pending = data.pendingCount !== undefined ? data.pendingCount : reservationsList.filter(r => (r.status || 'pendiente') === 'pendiente').length;
    const admitted = data.admittedCount !== undefined ? data.admittedCount : reservationsList.filter(r => r.status === 'admitida').length;
    const rejected = data.rejectedCount !== undefined ? data.rejectedCount : reservationsList.filter(r => r.status === 'rechazada').length;

    metricTotal.textContent = total;
    metricPending.textContent = pending;
    metricAdmitted.textContent = admitted;
    metricRejected.textContent = rejected;

    badgeAll.textContent = total;
    badgePending.textContent = pending;
    badgeAdmitted.textContent = admitted;
    badgeRejected.textContent = rejected;
  }

  // 2. Renderizado de tabla
  function renderTable() {
    const query = (searchInput.value || '').trim().toLowerCase();

    let filtered = reservationsList.filter(item => {
      const status = item.status || 'pendiente';
      if (currentTab === 'all') return true;
      return status === currentTab;
    });

    if (query) {
      filtered = filtered.filter(item => {
        return (
          (item.name && item.name.toLowerCase().includes(query)) ||
          (item.email && item.email.toLowerCase().includes(query)) ||
          (item.willingToPay40 && item.willingToPay40.toLowerCase().includes(query))
        );
      });
    }

    tableCounter.textContent = `${filtered.length} de ${reservationsList.length} solicitudes`;

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      emptyState.style.display = 'block';

      if (currentTab === 'pendiente') {
        emptyTitle.textContent = '¡Todo al día! No hay formularios en espera';
        emptyDesc.textContent = 'No tienes solicitudes pendientes de revisión en este momento.';
      } else if (currentTab === 'admitida') {
        emptyTitle.textContent = 'No hay solicitudes admitidas';
        emptyDesc.textContent = 'Revisa las solicitudes y pulsa "Admitir" para confirmar alumnos.';
      } else if (currentTab === 'rechazada') {
        emptyTitle.textContent = 'No hay solicitudes rechazadas';
        emptyDesc.textContent = 'Las solicitudes descartadas aparecerán aquí.';
      } else {
        emptyTitle.textContent = 'No se encontraron formularios';
        emptyDesc.textContent = 'Cuando las personas completen el formulario en la web aparecerán aquí.';
      }

      return;
    }

    emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map((item, index) => {
      const status = item.status || 'pendiente';
      return `
        <tr data-id="${item.id}">
          <td style="color: #94a3b8; font-weight: 600;">${index + 1}</td>
          <td class="user-name-cell">${escapeHtml(item.name)}</td>
          <td class="user-email-cell">
            <a href="mailto:${escapeHtml(item.email)}" style="color: inherit; text-decoration: none;">
              ${escapeHtml(item.email)}
            </a>
          </td>
          <td>
            ${renderPayPill(item.willingToPay40)}
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn-view-answers" onclick="viewQuiz('${item.id}')">
              📋 Ver Respuestas
            </button>
          </td>
          <td>
            ${renderStatusPill(status)}
          </td>
          <td>
            <div class="decision-actions">
              ${renderDecisionButtons(item.id, status, item.name)}
            </div>
          </td>
          <td style="text-align: center;">
            <button 
              type="button" 
              class="btn-delete-row" 
              title="Eliminar registro"
              onclick="deleteReservation('${item.id}', '${escapeJs(item.name)}')"
            >
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPayPill(answer) {
    const a = (answer || '').toLowerCase();
    if (a.includes('sí') || a.includes('si')) {
      return `<span class="pay-pill pay-pill-yes">🟢 Sí, totalmente</span>`;
    }
    if (a.includes('depende')) {
      return `<span class="pay-pill pay-pill-maybe">🟡 Depende</span>`;
    }
    if (a.includes('no')) {
      return `<span class="pay-pill pay-pill-no">🔴 No (gratis)</span>`;
    }
    return `<span class="pay-pill pay-pill-maybe">${escapeHtml(answer || 'No responde')}</span>`;
  }

  function renderStatusPill(status) {
    if (status === 'admitida') {
      return `<span class="status-pill status-admitida">✓ Admitida</span>`;
    }
    if (status === 'rechazada') {
      return `<span class="status-pill status-rechazada">✕ Rechazada</span>`;
    }
    return `<span class="status-pill status-pendiente">⏳ En Espera</span>`;
  }

  function renderDecisionButtons(id, status, name) {
    const escName = escapeJs(name);

    if (status === 'pendiente') {
      return `
        <button type="button" class="btn-decision btn-action-admit" onclick="changeStatus('${id}', 'admitida', '${escName}')" title="Admitir">
          ✓ Admitir
        </button>
        <button type="button" class="btn-decision btn-action-reject" onclick="changeStatus('${id}', 'rechazada', '${escName}')" title="Rechazar">
          ✕ Rechazar
        </button>
      `;
    }

    if (status === 'admitida') {
      return `
        <button type="button" class="btn-decision btn-action-wait" onclick="changeStatus('${id}', 'pendiente', '${escName}')" title="Poner en espera de nuevo">
          ⏳ Espera
        </button>
        <button type="button" class="btn-decision btn-action-reject" onclick="changeStatus('${id}', 'rechazada', '${escName}')" title="Cambiar a rechazada">
          ✕ Rechazar
        </button>
      `;
    }

    return `
      <button type="button" class="btn-decision btn-action-admit" onclick="changeStatus('${id}', 'admitida', '${escName}')" title="Admitir">
        ✓ Admitir
      </button>
      <button type="button" class="btn-decision btn-action-wait" onclick="changeStatus('${id}', 'pendiente', '${escName}')" title="Poner en espera de nuevo">
        ⏳ Espera
      </button>
    `;
  }

  // 3. Ver Formulario Completo del Alumno en Modal
  window.viewQuiz = (id) => {
    const item = reservationsList.find(r => r.id === id);
    if (!item) return;

    const status = item.status || 'pendiente';
    const escName = escapeJs(item.name);

    quizModalContent.innerHTML = `
      <div class="quiz-detail-list">
        <div class="quiz-detail-item">
          <div class="quiz-detail-q">Alumno / Contacto</div>
          <div class="quiz-detail-a">${escapeHtml(item.name)} &bull; <a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></div>
        </div>

        <div class="quiz-detail-item quiz-detail-highlight">
          <div class="quiz-detail-q">¿Serías capaz de pagar 40€ para aprender a hacer macramé?</div>
          <div class="quiz-detail-a">${renderPayPill(item.willingToPay40)} <span style="margin-left: 8px; font-size: 0.95rem;">${escapeHtml(item.willingToPay40)}</span></div>
        </div>

        <div class="quiz-detail-item">
          <div class="quiz-detail-q">¿Le interesa crear pulseras de macramé?</div>
          <div class="quiz-detail-a">${escapeHtml(item.interest || 'Sin respuesta')}</div>
        </div>

        <div class="quiz-detail-item">
          <div class="quiz-detail-q">¿Dónde nos ha encontrado?</div>
          <div class="quiz-detail-a">${escapeHtml(item.source || 'Sin respuesta')}</div>
        </div>

        ${item.previousExperience || item.previousGoal ? `
          <div class="quiz-detail-item">
            <div class="quiz-detail-q">Respuestas del formulario anterior</div>
            <div class="quiz-detail-a">
              ${item.previousExperience ? `Nivel de macramé: ${escapeHtml(item.previousExperience)}` : ''}
              ${item.previousExperience && item.previousGoal ? '<br>' : ''}
              ${item.previousGoal ? `Objetivo: ${escapeHtml(item.previousGoal)}` : ''}
            </div>
          </div>
        ` : ''}

        <div class="quiz-detail-item">
          <div class="quiz-detail-q">Fecha de Envío &bull; Estado Actual</div>
          <div class="quiz-detail-a">${escapeHtml(item.formattedDate || item.createdAt || '-')} &bull; ${renderStatusPill(status)}</div>
        </div>
      </div>
    `;

    quizModalFooter.innerHTML = `
      <button type="button" class="btn btn-outline" onclick="closeQuizModal()">Cerrar</button>
      <button type="button" class="btn btn-danger" style="background: #b91c1c; color: white;" onclick="changeStatus('${item.id}', 'rechazada', '${escName}'); closeQuizModal();">
        ✕ Rechazar Solicitud
      </button>
      <button type="button" class="btn btn-success" onclick="changeStatus('${item.id}', 'admitida', '${escName}'); closeQuizModal();">
        ✓ Admitir en el Curso
      </button>
    `;

    viewQuizModal.style.display = 'flex';
  };

  window.closeQuizModal = () => {
    viewQuizModal.style.display = 'none';
  };

  closeQuizModalBtn.addEventListener('click', closeQuizModal);
  viewQuizModal.addEventListener('click', (e) => {
    if (e.target === viewQuizModal) closeQuizModal();
  });

  // 4. Cambiar Estado
  window.changeStatus = async (id, newStatus, userName) => {
    try {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const item = reservationsList.find(r => r.id === id);
        if (item) {
          item.status = newStatus;
        }

        const statusLabels = {
          admitida: 'ADMITIDA',
          rechazada: 'RECHAZADA',
          pendiente: 'EN ESPERA'
        };

        const toastTypes = {
          admitida: 'success',
          rechazada: 'danger',
          pendiente: 'warning'
        };

        showToast(`Solicitud de ${userName} marcada como: ${statusLabels[newStatus]}`, toastTypes[newStatus]);

        updateMetrics({});
        renderTable();
      } else {
        showToast(data.message || 'Error al cambiar estado.', 'danger');
      }
    } catch (err) {
      showToast('Error de conexión.', 'danger');
    }
  };

  // 5. Pestañas
  window.filterByTab = (tabName) => {
    currentTab = tabName;
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    renderTable();
  };

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterByTab(btn.getAttribute('data-tab'));
    });
  });

  searchInput.addEventListener('input', renderTable);

  // 6. Configuración Hotmart
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success && data.config) {
        const c = data.config;
        hotmartUrlInput.value = c.hotmartUrl || '';
        courseStatusSelect.value = c.courseStatus || 'prelaunch';
        discountInput.value = c.discountPercentage || 50;

        if (c.hotmartUrl && c.hotmartUrl.trim().startsWith('http')) {
          testHotmartLink.href = c.hotmartUrl;
          testHotmartLink.style.display = 'inline-flex';
        } else {
          testHotmartLink.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error config:', err);
    }
  }

  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hotmartUrl = hotmartUrlInput.value.trim();
    const courseStatus = courseStatusSelect.value;
    const discountPercentage = parseInt(discountInput.value, 10) || 50;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotmartUrl, courseStatus, discountPercentage })
      });

      const data = await res.json();
      if (data.success) {
        if (hotmartUrl.startsWith('http')) {
          testHotmartLink.href = hotmartUrl;
          testHotmartLink.style.display = 'inline-flex';
        } else {
          testHotmartLink.style.display = 'none';
        }

        configSavedAlert.textContent = '✓ Guardado correctamente';
        setTimeout(() => { configSavedAlert.textContent = ''; }, 3000);
        showToast('Enlace de Hotmart guardado.', 'success');
      }
    } catch (err) {
      showToast('Error al guardar.', 'danger');
    }
  });

  // 7. Borrar
  window.deleteReservation = async (id, name) => {
    if (!confirm(`¿Eliminar la solicitud de "${name}"?`)) return;

    try {
      const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        showToast(`Solicitud de ${name} eliminada.`, 'success');
        reservationsList = reservationsList.filter(r => r.id !== id);
        updateMetrics({});
        renderTable();
      }
    } catch (err) {
      showToast('Error al eliminar.', 'danger');
    }
  };

  // 8. Añadir Manual
  openAddModalBtn.addEventListener('click', () => {
    modalError.textContent = '';
    addManualForm.reset();
    addModal.style.display = 'flex';
    manualName.focus();
  });

  const closeModal = () => { addModal.style.display = 'none'; };
  closeAddModalBtn.addEventListener('click', closeModal);
  cancelAddModalBtn.addEventListener('click', closeModal);
  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) closeModal();
  });

  addManualForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.textContent = '';

    const name = manualName.value.trim();
    const email = manualEmail.value.trim();
    const willingToPay40 = manualPay.value;
    const status = manualStatus.value;

    if (!name || !email) {
      modalError.textContent = 'Nombre y correo son obligatorios.';
      return;
    }

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, willingToPay40, status })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        closeModal();
        showToast(`Solicitud de ${name} añadida.`, 'success');
        loadReservations();
      } else {
        modalError.textContent = data.message || 'Error al guardar.';
      }
    } catch (err) {
      modalError.textContent = 'Error de conexión.';
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadReservations();
    loadConfig();
    showToast('Datos actualizados', 'success');
  });

  function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : (type === 'danger' ? '✕' : '⏳');
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3500);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeJs(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
});
