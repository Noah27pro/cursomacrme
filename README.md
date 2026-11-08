# 🪢 Sistema de Solicitud y Admisión con Supabase - Curso Pulseras de Macramé

Web con diseño minimalista oscuro (**fondo negro y botón central**) y base de datos en tiempo real en **Supabase** para gestionar los clientes y admitir o rechazar alumnos.

---

## ⚡ Conexión con Supabase

El sistema está conectado directamente con tu proyecto de **Supabase**:
* **Proyecto:** `Noah27pro's Project` (`yhzyyebirnorxgtdhjrl`)
* **Tabla de Clientes:** `public.solicitudes`
  * `id` (UUID único autogenerado)
  * `nombre` (Nombre del cliente)
  * `email` (Correo electrónico)
  * `dispuesto_pagar_40` (Respuesta a: *¿Serías capaz de pagar 40€?*)
  * `le interesa` (Interés en crear pulseras de macramé)
  * `donde nos ha encontrado` (TikTok, boca a boca, YouTube u otros)
  * `estado` (*'pendiente'*, *'admitido'*, *'rechazado'*)
  * `created_at` (Fecha y hora exacta de registro)
* **Compatibilidad de esquema:** La aplicación admite los nombres actuales, los nombres normalizados de la migración y el esquema antiguo. Para normalizar las columnas y archivar respuestas antiguas, ejecuta `supabase/migrations/20261108175000_update_solicitudes_columns.sql` en el SQL Editor de Supabase.
* **Tabla de Configuración:** `public.ajustes`
  * `clave: 'enlace_curso'` (Enlace de Hotmart sincronizado)

---

## 🚀 Cómo Iniciar el Servidor

Configura las variables de `.env.example` en `.env` antes de iniciar. El panel requiere `ADMIN_PASSWORD`; si no está configurada, permanece bloqueado. El nombre de usuario predeterminado es `admin` y se puede cambiar con `ADMIN_USERNAME`.

```bash
npm start
```
*(o también: `node server.js`)*

* 🌐 **Web Principal Minimalista:** [http://localhost:3000](http://localhost:3000)
* 🔐 **Panel de Control (Admisiones en Supabase):** [http://localhost:3000/admin](http://localhost:3000/admin)

## Publicar en Vercel

Importa este repositorio en Vercel y configura estas variables de entorno antes del despliegue:

* `SUPABASE_URL`
* `SUPABASE_KEY` (clave publicable/anon de Supabase; nunca uses `service_role`)
* `ADMIN_USERNAME`
* `ADMIN_PASSWORD` (contraseña larga y única; no la guardes en el repositorio)

Después de añadir o cambiar variables, crea un nuevo despliegue. El panel y sus API requieren autenticación HTTP Basic. Vercel no conserva escrituras en el disco local entre ejecuciones; la persistencia de solicitudes y el enlace del curso depende de Supabase.

---

## 📋 Flujo de Datos

1. **El cliente rellena el formulario en la web:**
   * Correo válido obligatorio; el nombre es opcional. También se registran el interés en crear pulseras y cómo nos encontró.
   * Hace clic en **"Enviar Solicitud"**.
2. **Se guarda automáticamente en Supabase:**
   * El registro se inserta en la tabla `solicitudes` de Supabase con estado `pendiente`.
   * El cliente ve inmediatamente el **Mensaje de Espera**.
3. **El administrador gestiona desde el Panel:**
   * Abre [http://localhost:3000/admin](http://localhost:3000/admin).
   * Los datos se cargan en tiempo real desde Supabase.
   * Puede ver las respuestas y pulsar **`✓ Admitir`** o **`✕ Rechazar`**, actualizando el estado directamente en Supabase.
