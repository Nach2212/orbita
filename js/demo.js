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
        finanzas: { ok: true, mes: 'Octubre 2026', dia: 27, diasMes: 31, ingresos: 250000, gastos: 142300, saldo: 107700, ahorro: 0.43,
          grupos: [{ id: 'basico', nombre: 'Básico', regla: 0.5, tope: 125000, usado: 58300 }, { id: 'ocio', nombre: 'Ocio', regla: 0.3, tope: 75000, usado: 64000 }],
          categorias: [{ nombre: 'Comida', monto: 38000, grupo: 'basico' }, { nombre: 'Supermercado', monto: 31500, grupo: 'basico' }, { nombre: 'Ocio', monto: 26000, grupo: 'ocio' }, { nombre: 'Transporte', monto: 18800, grupo: 'basico' }, { nombre: 'Salud', monto: 8000, grupo: 'basico' }],
          cuentas: [{ nombre: 'Básico', regla: 0.5, saldo: 40000 }, { nombre: 'Ocio', regla: 0.3, saldo: 12000 }, { nombre: 'Ahorro', regla: 0.2, saldo: 150000 }],
          historia: [{ mes: 'ago 26', ingresos: 200000, gastos: 90000 }, { mes: 'sep 26', ingresos: 230000, gastos: 195000 }, { mes: 'oct 26', ingresos: 250000, gastos: 142300 }],
          ultimos: [{ fecha: Date.now(), tipo: 'gasto', categoria: 'Comida', desc: 'Almuerzo', monto: 4500 }, { fecha: Date.now() - 864e5, tipo: 'ingreso', categoria: 'Otros', desc: 'Pago proyecto', monto: 100000 }],
          consejos: ['Vas gastando Ocio más rápido que el mes: llevas 85% del tope y va el 87% del mes.', 'Vas ahorrando 43% de lo que entró: sobre tu meta del 20%.'] },
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
