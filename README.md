# Órbita 🪐

App web personal: casa (sensores y aparatos), y más adelante finanzas, deporte y proyectos, en un solo lugar.
Funciona dentro y fuera de casa, se instala en el celular y solo entra tu cuenta de Google.

- **Demo sin configurar nada:** abre `index.html?demo=1`
- **Diseño completo:** documento "Órbita · Documento de diseño"

## Cómo está armado

```
Aparatos ESP32 ──HTTP──> ThingSpeak <──── Cerebro (Apps Script) ────> App (GitHub Pages)
                                          │  verifica tu login
                          Tu Google  ─────┘  guarda historial, manda alertas (ntfy)
```

| Carpeta | Qué es |
| --- | --- |
| `/` | La app (HTML + CSS + JS, sin compilar nada) |
| `cerebro/` | Código del Apps Script. `Config.gs` (con tus claves) **nunca** se sube |

Nada de este repositorio es secreto: el Client ID de Google y la URL del cerebro son públicos por diseño;
el cerebro rechaza a cualquiera que no sea tu cuenta.

---

## Puesta en marcha (una sola vez, ~40 min)

### 1 · ThingSpeak (datos y órdenes de los aparatos)
1. Crea una cuenta gratis en [thingspeak.mathworks.com](https://thingspeak.mathworks.com).
2. **Channels → New Channel** → nombre `K-PLER`, activa 4 campos: `co2`, `temp`, `hum`, `nivel` → Save.
   Anota: **Channel ID**, **Write API Key** y **Read API Key** (pestaña *API Keys*).
3. **New Channel** otra vez → nombre `Orbita a K-PLER`, 1 campo: `agenda` → Save.
   Anota: **Channel ID**, **Write API Key**, **Read API Key**.
4. **Apps → TalkBack → New TalkBack** → nombre `K-PLER ordenes` → Save.
   Anota: **TalkBack ID** y **API Key**.

### 2 · GitHub Pages (donde vive la app)
1. Crea el repositorio público **`orbita`** en tu cuenta `nach2212`.
2. Sube todo el contenido de esta carpeta (arrastrar y soltar en *Add file → Upload files* sirve).
3. **Settings → Pages → Branch: `main` / `(root)`** → Save. En 1–2 min queda en `https://nach2212.github.io/orbita/`.

### 3 · Google Cloud (el login)
1. [console.cloud.google.com](https://console.cloud.google.com) → crea el proyecto **Orbita**.
2. **APIs y servicios → Pantalla de consentimiento de OAuth** → *Externo* → nombre Órbita, tu correo → guarda.
   En *Usuarios de prueba* agrega tu propio correo.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
   *Orígenes autorizados de JavaScript:* `https://nach2212.github.io` (y `http://localhost:8000` si quieres probar en el PC).
4. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

### 4 · El cerebro (Apps Script)
1. [script.google.com](https://script.google.com) → **Proyecto nuevo** → nómbralo `Órbita cerebro`.
2. Pega `cerebro/Code.gs` en `Código.gs`.
3. Crea un archivo **Config.gs**, pega `cerebro/Config.ejemplo.gs` y **llena tus valores** (correo, Client ID, claves de ThingSpeak, tema de ntfy).
4. ⚙️ **Configuración del proyecto → Mostrar "appsscript.json"** → pega `cerebro/appsscript.json`.
5. Elige la función **`instalar`** → ▶ Ejecutar → acepta los permisos. Crea la planilla "Órbita · datos" y los activadores.
6. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como: *Yo*. Acceso: *Cualquier usuario*. Copia la URL (`…/exec`).
   *(Es "cualquier usuario" para que la app pueda llamarlo; igual el cerebro solo responde a tu cuenta.)*

### 5 · Conectar la app
Edita `js/config.js` en GitHub: pega `CEREBRO_URL` y `CLIENT_ID` → Commit. Abre la app, entra con Google. Listo.

### 6 · Alertas al celular
Instala **ntfy** (Play Store) → **+** → suscríbete al mismo tema que pusiste en `NTFY_TEMA`.
Prueba: en Apps Script ejecuta `probarAlerta`.

### 7 · Instalar en el celular
Abre la app en Chrome → menú ⋮ → **Agregar a pantalla principal**.

---

## Reglas que el código cumple

| Regla | Cómo |
| --- | --- |
| Planillas que cambian | Pestañas y columnas se buscan por nombre; si falta algo, la app lo dice |
| Órdenes vencen | Cada orden lleva su hora; el aparato ignora las de más de 2 min y cada una se ejecuta una vez |
| Sin internet se nota | "hace X min", aparato "desconectado" sobre 5 min, huecos en el gráfico |
| Una sola hora | Todo en `America/Santiago`; ThingSpeak en UTC y el cerebro convierte |
| Calibración del CO₂ | Aviso si en 7 días el aire nunca bajó de 550 ppm + botón "Calibrar CO2" |
| Alertas sin spam | Una al empeorar, otra si llega a crítico, una al mejorar; nada de 0 a 8 h |

## Sumar un aparato nuevo (ej. la cortina)
1. En ThingSpeak: un canal (si mide algo) y un TalkBack para sus órdenes.
2. En la planilla "Órbita · datos", hoja **Aparatos**, agrega una fila:
   `cortina | Cortina | Pieza | (vacío) | subir:Subir, bajar:Bajar, parar:Parar | | | <talkback id> | <talkback key>`
3. Al ESP32 de la cortina le cargas el mismo módulo `orbita` de K-PLER. La app muestra sus botones sola.
