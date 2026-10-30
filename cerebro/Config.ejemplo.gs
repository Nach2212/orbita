/**
 * ÓRBITA · Configuración del cerebro
 * Copia este archivo como "Config.gs" DENTRO de Apps Script y llena los valores.
 * NUNCA subas el Config.gs con tus claves a GitHub.
 */
const CONFIG = {
  DUENO: 'tu-correo@gmail.com',            // la única cuenta que puede entrar
  CLIENT_ID: 'xxxxxxxx.apps.googleusercontent.com',   // de Google Cloud (paso 2 de la guía)
  APP_URL: 'https://nach2212.github.io/orbita/',

  LAT: -36.83, LON: -73.05,                // Concepción

  // K-PLER en ThingSpeak (paso 3 de la guía)
  TS_KPLER_CANAL: '',                      // Channel ID del canal "K-PLER"
  TS_KPLER_CLAVE_LECTURA: '',              // Read API Key de ese canal
  TS_KPLER_TALKBACK: '',                   // TalkBack ID
  TS_KPLER_CLAVE_TALKBACK: '',             // TalkBack API Key

  // Canal "Órbita → K-PLER" (la agenda que K-PLER muestra en pantalla)
  TS_AGENDA_CANAL: '',
  TS_AGENDA_CLAVE_ESCRITURA: '',

  // Finanzas: ID de tu planilla "Flujo de ingresos" (está en su URL, entre /d/ y /edit)
  FINANZAS_ID: '',
  // Tu "sueldo" operativo FIJO al mes por grupo (los nombres = columna Grupo de la pestaña Presupuesto).
  // Bórralo para volver a topes por % del ingreso del mes.
  PRESUPUESTO_MES: { 'Básico': 51353, 'Ocio': 20541, 'Lab': 10270 },
  // Proyectos: ID de tu planilla "Manejo de fondos"
  PROYECTOS_ID: '',

  // Alertas al celular (app ntfy). Un nombre largo y difícil de adivinar.
  NTFY_TEMA: '',
};
