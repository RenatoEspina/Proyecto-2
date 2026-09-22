// ui-grafico.js — gráfico de participación de mercado (Chart.js).

/* global Chart */

let instanciaGrafico = null;

const PALETA = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#4b5563', '#65a30d', '#ea580c', '#0d9488', '#9333ea',
];

/** Color destacado para la entidad resultante de la fusión, en la vista post-operación. */
const COLOR_FUSION = '#b91c1c';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} resultado - salida de analizarOperacion
 * @param {'pre'|'post'} vista
 */
export function renderGrafico(canvas, resultado, vista = 'pre') {
  const datos = vista === 'post' ? resultado.actoresPost : resultado.actoresOrdenados;
  const labels = datos.map((a) => a.nombre);
  const valores = datos.map((a) => a.cuota);
  const colores = datos.map((a, i) => (a.esEntidadFusionada ? COLOR_FUSION : PALETA[i % PALETA.length]));

  if (instanciaGrafico) {
    instanciaGrafico.data.labels = labels;
    instanciaGrafico.data.datasets[0].data = valores;
    instanciaGrafico.data.datasets[0].backgroundColor = colores;
    instanciaGrafico.update();
    return instanciaGrafico;
  }

  instanciaGrafico = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: valores, backgroundColor: colores, borderColor: '#fff', borderWidth: 1 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // El informe exportado incorpora el gráfico como PNG; sin esto el canvas se
      // limpia tras pintarse y toDataURL devuelve una imagen en blanco.
      animation: { duration: 0 },
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(2)} %`,
          },
        },
      },
    },
  });
  return instanciaGrafico;
}

/**
 * Devuelve el gráfico actual como PNG (data URL) para incrustarlo en el informe.
 * Se pinta sobre fondo blanco: el canvas es transparente y al imprimirlo a PDF
 * las porciones oscuras del gráfico quedarían ilegibles.
 */
export function graficoComoPNG(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return null;
  try {
    const lienzo = document.createElement('canvas');
    lienzo.width = canvas.width;
    lienzo.height = canvas.height;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(canvas, 0, 0);
    return lienzo.toDataURL('image/png');
  } catch {
    return null;
  }
}
