require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yhzyyebirnorxgtdhjrl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloenl5ZWJpcm5vcnhndGRoanJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNTcxMDAsImV4cCI6MjEwOTYzMzEwMH0.7MFW87TdvE5UG-X1XMp0BUFy6oGDMb76U3mhpdZObKg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EMAIL_REGEX = /^[^\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

const DATA_DIR = path.join(__dirname, 'data');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  courseTitle: "Curso Online: Pulseras de Macramé",
  courseStatus: "prelaunch",
  hotmartUrl: "",
  discountPercentage: 50,
  priceBefore: "49.00€",
  priceNow: "24.50€"
};

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
}

function getLocalConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

function saveLocalConfig(data) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

// Helper: Formato de fecha legible
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

// Helper: Mapeo de estado
function normalizeStatus(st) {
  if (!st) return 'pendiente';
  const s = st.toLowerCase();
  if (s === 'admitido' || s === 'admitida') return 'admitida';
  if (s === 'rechazado' || s === 'rechazada') return 'rechazada';
  return 'pendiente';
}

function toDbStatus(st) {
  if (!st) return 'pendiente';
  const s = st.toLowerCase();
  if (s === 'admitida' || s === 'admitido') return 'admitido';
  if (s === 'rechazada' || s === 'rechazado') return 'rechazado';
  return 'pendiente';
}

function isInterestAnswer(value) {
  return value === 'Sí, me interesa' || value === 'No, no me interesa';
}

function isSourceAnswer(value) {
  return ['TikTok', 'Boca a boca', 'YouTube', 'Otros'].includes(value);
}

function getInterestAnswer(row) {
  return row['le interesa']
    || row.interesado_en_crear_pulseras
    || (isInterestAnswer(row.experiencia) ? row.experiencia : 'Sin respuesta');
}

function getSourceAnswer(row) {
  return row['donde nos ha encontrado']
    || row.como_nos_encontro
    || (isSourceAnswer(row.motivo) ? row.motivo : 'Sin respuesta');
}

function getPreviousExperience(row) {
  return row.nivel_macrame_anterior
    || (row.experiencia && !isInterestAnswer(row.experiencia) ? row.experiencia : null);
}

function getPreviousGoal(row) {
  return row.objetivo_anterior
    || (row.motivo && !isSourceAnswer(row.motivo) ? row.motivo : null);
}

function isMissingColumnError(error, columns) {
  const missingColumn = columns.some(column => error?.message?.includes(column));
  return missingColumn && ['PGRST204', '42703'].includes(error.code);
}

async function insertReservation({ name, email, willingToPay40, interest, source, status }) {
  const commonFields = {
    nombre: name,
    email,
    dispuesto_pagar_40: willingToPay40,
    estado: status
  };

  const answerFieldSets = [
    { 'le interesa': interest, 'donde nos ha encontrado': source },
    { interesado_en_crear_pulseras: interest, como_nos_encontro: source },
    { experiencia: interest, motivo: source }
  ];

  for (let index = 0; index < answerFieldSets.length; index += 1) {
    const answerFields = answerFieldSets[index];
    const result = await supabase
      .from('solicitudes')
      .insert({ ...commonFields, ...answerFields })
      .select()
      .single();

    if (!result.error || !isMissingColumnError(result.error, Object.keys(answerFields)) || index === answerFieldSets.length - 1) {
      return result;
    }

    console.warn('Las columnas de respuesta de Supabase tienen otros nombres; probando el siguiente formato compatible.');
  }

  return { data: null, error: new Error('No se pudo insertar la solicitud con un formato compatible.') };
}

function getStatusUserMessage(status, name) {
  const norm = normalizeStatus(status);
  if (norm === 'admitida') {
    return `¡Enhorabuena ${name}! Tu solicitud ha sido ADMITIDA. Puedes acceder al curso en Hotmart.`;
  }
  if (norm === 'rechazada') {
    return `Hola ${name}. Tu solicitud no ha podido ser admitida en esta convocatoria debido al límite de plazas.`;
  }
  return `Hola ${name}. Tu solicitud ya fue enviada y está EN LISTA DE ESPERA Y REVISIÓN por el administrador.`;
}

// ================= API ENDPOINTS CON SUPABASE =================

// 1. Guardar nueva solicitud de reserva en SUPABASE
app.post('/api/reserve', async (req, res) => {
  const { name, email, willingToPay40, interest, source } = req.body;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Por favor, introduce un correo electrónico válido.' });
  }

  const cleanName = typeof name === 'string' && name.trim() ? name.trim() : 'Sin nombre';
  const cleanEmail = email.trim().toLowerCase();
  const cleanPay = willingToPay40 || 'No especificado';
  const cleanInterest = interest || 'Sí, me interesa';
  const cleanSource = source || 'Otros';

  try {
    // 1.1 Verificar si el email ya existe en Supabase
    const { data: existing, error: checkError } = await supabase
      .from('solicitudes')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.warn('Advertencia al verificar email en Supabase:', checkError.message);
    }

    if (existing) {
      const normStatus = normalizeStatus(existing.estado);
      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        status: normStatus,
        reservation: {
          id: existing.id,
          name: existing.nombre,
          email: existing.email,
          status: normStatus,
          willingToPay40: existing.dispuesto_pagar_40,
          formattedDate: formatDate(existing.created_at)
        },
        message: getStatusUserMessage(normStatus, existing.nombre)
      });
    }

    // 1.2 Insertar nuevo registro en Supabase
    const { data: inserted, error: insertError } = await insertReservation({
      name: cleanName,
      email: cleanEmail,
      willingToPay40: cleanPay,
      interest: cleanInterest,
      source: cleanSource,
      status: 'pendiente'
    });

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      return res.status(500).json({
        success: false,
        message: 'No se pudo guardar la solicitud. Inténtalo de nuevo más tarde.'
      });
    }

    const normStatus = normalizeStatus(inserted.estado);

    res.status(201).json({
      success: true,
      alreadyRegistered: false,
      status: normStatus,
      data: {
        id: inserted.id,
        name: inserted.nombre,
        email: inserted.email,
        willingToPay40: inserted.dispuesto_pagar_40,
        interest: getInterestAnswer(inserted),
        source: getSourceAnswer(inserted),
        status: normStatus,
        createdAt: inserted.created_at,
        formattedDate: formatDate(inserted.created_at)
      },
      message: `¡Formulario recibido y guardado en Supabase, ${cleanName}! Tu solicitud está en lista de espera y en revisión por el administrador.`
    });

  } catch (err) {
    console.error('Excepción al conectar con Supabase:', err);
    res.status(500).json({ success: false, message: 'Error de servidor con la base de datos Supabase.' });
  }
});

// 2. Consultar estado de una solicitud en SUPABASE por email
app.get('/api/status', async (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'Introduce un correo electrónico válido.' });
  }

  try {
    const { data: found, error } = await supabase
      .from('solicitudes')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (error) {
      console.error('Error consultando Supabase:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar Supabase.' });
    }

    if (!found) {
      return res.json({ success: true, found: false });
    }

    const normStatus = normalizeStatus(found.estado);

    // Obtener enlace de Hotmart si está admitido
    let hotmartUrl = '';
    const { data: linkAjuste } = await supabase
      .from('ajustes')
      .select('valor')
      .eq('clave', 'enlace_curso')
      .maybeSingle();

    if (linkAjuste && linkAjuste.valor && linkAjuste.valor !== 'PENDIENTE') {
      hotmartUrl = linkAjuste.valor;
    } else {
      const localCfg = getLocalConfig();
      hotmartUrl = localCfg.hotmartUrl || '';
    }

    res.json({
      success: true,
      found: true,
      reservation: {
        id: found.id,
        name: found.nombre,
        email: found.email,
        status: normStatus,
        willingToPay40: found.dispuesto_pagar_40,
        formattedDate: formatDate(found.created_at)
      },
      hotmartUrl: normStatus === 'admitida' ? hotmartUrl : null,
      message: getStatusUserMessage(normStatus, found.nombre)
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: 'Error al conectar con Supabase.' });
  }
});

// 3. Listar todas las solicitudes desde SUPABASE (Panel de Control)
app.get('/api/reservations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listando de Supabase:', error);
      return res.status(500).json({ success: false, message: 'Error al leer de Supabase.' });
    }

    const rows = data || [];
    const today = new Date().toISOString().split('T')[0];

    const mapped = rows.map(r => ({
      id: r.id,
      name: r.nombre,
      email: r.email,
      willingToPay40: r.dispuesto_pagar_40 || 'No especificado',
      interest: getInterestAnswer(r),
      source: getSourceAnswer(r),
      previousExperience: getPreviousExperience(r),
      previousGoal: getPreviousGoal(r),
      status: normalizeStatus(r.estado),
      createdAt: r.created_at,
      formattedDate: formatDate(r.created_at)
    }));

    const total = mapped.length;
    const todayCount = mapped.filter(r => r.createdAt && r.createdAt.startsWith(today)).length;
    const pendingCount = mapped.filter(r => r.status === 'pendiente').length;
    const admittedCount = mapped.filter(r => r.status === 'admitida').length;
    const rejectedCount = mapped.filter(r => r.status === 'rechazada').length;

    res.json({
      success: true,
      total,
      todayCount,
      pendingCount,
      admittedCount,
      rejectedCount,
      reservations: mapped
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: 'Error de conexión con Supabase.' });
  }
});

// 4. Cambiar estado en SUPABASE (Admitir / Rechazar)
app.patch('/api/reservations/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pendiente', 'admitida', 'rechazada'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Estado no válido. Debe ser "pendiente", "admitida" o "rechazada".'
    });
  }

  const dbStatus = toDbStatus(status);

  try {
    const { data: updated, error } = await supabase
      .from('solicitudes')
      .update({ estado: dbStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando en Supabase:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar en Supabase: ' + error.message });
    }

    res.json({
      success: true,
      message: `Solicitud de "${updated.nombre}" actualizada a: ${status.toUpperCase()} en Supabase`,
      data: {
        id: updated.id,
        name: updated.nombre,
        email: updated.email,
        status: normalizeStatus(updated.estado)
      }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: 'Error al conectar con Supabase.' });
  }
});

// 5. Crear solicitud manual en SUPABASE
app.post('/api/reservations', async (req, res) => {
  const { name, email, willingToPay40, interest, source, status } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Nombre y correo son obligatorios.' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const dbStatus = toDbStatus(status || 'admitida');

  try {
    const { data: inserted, error } = await insertReservation({
      name: cleanName,
      email: cleanEmail,
      willingToPay40: willingToPay40 || 'Sí, totalmente',
      interest: interest || 'Manual',
      source: source || 'Manual',
      status: dbStatus
    });

    if (error) {
      console.error('Error al insertar manual en Supabase:', error);
      return res.status(500).json({ success: false, message: 'No se pudo guardar la solicitud manual.' });
    }

    res.status(201).json({
      success: true,
      data: {
        id: inserted.id,
        name: inserted.nombre,
        email: inserted.email,
        status: normalizeStatus(inserted.estado),
        formattedDate: formatDate(inserted.created_at)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error de servidor con Supabase.' });
  }
});

// 6. Eliminar solicitud de SUPABASE
app.delete('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('solicitudes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al borrar de Supabase:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'Solicitud eliminada de Supabase.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al conectar con Supabase.' });
  }
});

// 7. Exportar CSV con datos en vivo de SUPABASE
app.get('/api/reservations/export', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).send('Error leyendo datos de Supabase.');
    }

    const rows = data || [];
    let csv = '\uFEFFID,Nombre,Correo Electronico,Estado,Pagaria 40 Euros?,Interes en crear pulseras,Como nos encontro,Nivel anterior,Objetivo anterior,Fecha Registro\n';

    rows.forEach(r => {
      const escapedName = `"${(r.nombre || '').replace(/"/g, '""')}"`;
      const escapedEmail = `"${(r.email || '').replace(/"/g, '""')}"`;
      const normStatus = normalizeStatus(r.estado);
      const statusLabel = normStatus === 'admitida' ? 'Admitida' : (normStatus === 'rechazada' ? 'Rechazada' : 'En Espera');
      const escapedStatus = `"${statusLabel}"`;
      const escapedPay = `"${(r.dispuesto_pagar_40 || '').replace(/"/g, '""')}"`;
      const escapedInterest = `"${getInterestAnswer(r).replace(/"/g, '""')}"`;
      const escapedSource = `"${getSourceAnswer(r).replace(/"/g, '""')}"`;
      const escapedPreviousExperience = `"${(getPreviousExperience(r) || '').replace(/"/g, '""')}"`;
      const escapedPreviousGoal = `"${(getPreviousGoal(r) || '').replace(/"/g, '""')}"`;
      const escapedDate = `"${formatDate(r.created_at)}"`;
      csv += `${r.id},${escapedName},${escapedEmail},${escapedStatus},${escapedPay},${escapedInterest},${escapedSource},${escapedPreviousExperience},${escapedPreviousGoal},${escapedDate}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="solicitudes-supabase-macrame.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).send('Error exportando.');
  }
});

// 8. Configuración y sincronización con tabla ajustes en SUPABASE
app.get('/api/config', async (req, res) => {
  let hotmartUrl = '';
  try {
    const { data: enlaceAjuste } = await supabase
      .from('ajustes')
      .select('valor')
      .eq('clave', 'enlace_curso')
      .maybeSingle();

    if (enlaceAjuste && enlaceAjuste.valor && enlaceAjuste.valor !== 'PENDIENTE') {
      hotmartUrl = enlaceAjuste.valor;
    }
  } catch (e) {}

  const localCfg = getLocalConfig();
  if (hotmartUrl) localCfg.hotmartUrl = hotmartUrl;

  res.json({ success: true, config: localCfg });
});

app.post('/api/config', async (req, res) => {
  const current = getLocalConfig();
  const updated = { ...current, ...req.body };
  saveLocalConfig(updated);

  if (req.body.hotmartUrl !== undefined) {
    try {
      await supabase
        .from('ajustes')
        .upsert({ clave: 'enlace_curso', valor: req.body.hotmartUrl || 'PENDIENTE' });
    } catch (e) {
      console.warn('Error guardando enlace en ajustes de Supabase:', e);
    }
  }

  res.json({ success: true, config: updated, message: 'Configuración actualizada en Supabase y local.' });
});

// Servir frontend
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Curso de Pulseras de Macramé`);
  console.log(` Base de datos: SUPABASE ACTIVA (Noah27pro's Project)`);
  console.log(`  Web de Reserva:    http://localhost:${PORT}`);
  console.log(`  Panel de Control:  http://localhost:${PORT}/admin`);
  console.log(`=======================================================`);
});
