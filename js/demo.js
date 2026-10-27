// ÓRBITA · modo demo (?demo=1): datos de ejemplo para probar la app sin cerebro ni login
(function () {
  function serie24h() {
    const ahora = Date.now(), pts = [];
    for (let t = ahora - 24 * 3600e3; t <= ahora; t += 300e3) {
      const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      // de noche con la puerta cerrada sube; en la mañana se ventila
      let co2 = 620 + 180 * Math.sin((h - 9) / 24 * Math.PI * 2);
      if (h >= 0 && h < 8) co2 = 700 + h * 95;
      if (h >= 8 && h < 9) co2 = 1460 - (h - 8) * 820;
      if (h >= 18) co2 += (h - 18) * 60;
      co2 += Math.sin(t / 7e5) * 25;
      if (t > ahora - 14 * 3600e3 && t < ahora - 13.3 * 3600e3) continue;   // un corte de WiFi: hueco
      pts.push({ t, co2: Math.round(co2), temp: Math.round((21.5 + Math.sin((h - 15) / 24 * Math.PI * 2) * 2) * 10) / 10, hum: Math.round(52 + Math.sin(h / 4) * 6) });
    }
    return pts;
  }

  function responder(accion, extra) {
    return new Promise((ok) => setTimeout(() => {
      if (accion === 'orden') return ok({ ok: true, enviada: Date.now(), demo: true });
      const serie = serie24h(), u = serie[serie.length - 1];
      const hoy = new Date(); hoy.setSeconds(0, 0);
      const en = (min) => hoy.getTime() + min * 60e3;
      ok({
        ok: true, ahora: Date.now(), demo: true,
        aparatos: [{
          id: 'kpler', nombre: 'K-PLER', lugar: 'Pieza', mide: ['co2', 'temp', 'hum'],
          acciones: [{ id: 'fiesta', nombre: 'Fiesta' }, { id: 'parar', nombre: 'Parar' }, { id: 'clima', nombre: 'Mostrar clima' }, { id: 'calibrar_co2', nombre: 'Calibrar CO2' }],
          ultimo: { t: Date.now() - 50e3, co2: u.co2, temp: u.temp, hum: u.hum, nivel: u.co2 >= 1200 ? 2 : u.co2 >= 800 ? 1 : 0 },
          serie,
          noche: { prom: 1060, max: 1460, minutosSobre1000: 214, nota: 4, enCurso: new Date().getHours() < 8 },
          calibrar: false,
        }],
        clima: { temp: 16.4, sensacion: 15.1, codigo: 2, viento: 14, max: 19, min: 9, lluvia: 10, t: Date.now() },
        eventos: [
          { titulo: 'Reunión de proyecto', inicio: en(42), fin: en(132), todoElDia: false, calendario: 'Personal' },
          { titulo: 'Entrenamiento', inicio: en(300), fin: en(390), todoElDia: false, calendario: 'Personal' },
          { titulo: 'Certamen', inicio: en(60 * 26), fin: en(60 * 28), todoElDia: false, calendario: 'Universidad' },
        ],
      });
    }, 350));
  }

  window.OrbitaDemo = { responder };
})();
