# Calculadora IHH — Análisis de operaciones de concentración

Prototipo funcional del proyecto **Match Making** (Derecho PUCV + Ingeniería Civil
Informática PUCV). Calcula el índice Herfindahl-Hirschman (IHH/HHI) a partir de una base
de ventas y aplica el árbol de decisión del párrafo 35 de la *Guía para el Análisis de
Operaciones de Concentración Horizontales* de la FNE (vigente desde el 31-05-2022).

- **Plan técnico-jurídico completo:** [`../PLAN_PROTOTIPO_HHI.md`](../PLAN_PROTOTIPO_HHI.md)
- **Manual para el equipo de Derecho:** [`GUIA_DE_USO.md`](GUIA_DE_USO.md)

---

## Para usarla (equipo de Derecho)

**Doble clic en `dist/Calculadora-IHH.html`.** Es un único archivo autocontenido: se abre
en el navegador, no requiere instalación, servidor ni conexión a internet, y puede
copiarse a un pendrive o enviarse por correo. Todo el procesamiento ocurre en el
navegador del usuario: ningún dato sale del equipo (RNF-01).

El paso a paso está en [`GUIA_DE_USO.md`](GUIA_DE_USO.md), y la propia aplicación trae un
botón **«? ¿Cómo se usa?»** con instrucciones y glosario.

## Para desarrollar

El código fuente es una SPA sin framework: HTML + CSS + JavaScript con módulos ES.
Como los navegadores bloquean los módulos ES cargados desde `file://`, la versión de
desarrollo necesita un servidor estático:

```bash
npm install
npm run serve      # http://localhost:8080
```

### Pruebas

```bash
npm test           # 60 pruebas unitarias con Vitest
```

Cubren los diez casos T1–T10 del plan (§10) —incluido el caso límite T7, donde el ΔIHH
es exactamente igual al umbral y por tanto **no** cae en el safe harbour—, la
normalización de datos sucios, la agrupación de filiales y los umbrales del art. 48.

### Build del archivo único

```bash
npm run build      # genera dist/Calculadora-IHH.html
```

El build empaqueta los módulos con esbuild e incrusta el CSS y las librerías en un solo HTML.
**Ese archivo es el entregable para el equipo de Derecho**; el código modular sigue
siendo la fuente de verdad y es lo que se prueba y se audita.

Hay que volver a ejecutarlo después de cualquier cambio en `src/`, `style.css`,
o `index.html`.

---

## Estructura

```
calculadora-hhi/
├── dist/Calculadora-IHH.html   # ⭐ entregable: archivo único, doble clic
├── index.html                  # versión de desarrollo (requiere servidor)
├── style.css
├── build.js                    # empaquetado a archivo único
├── vendor/                     # PapaParse, SheetJS y Chart.js vendorizados (sin CDN)
├── src/
│   ├── main.js                 # orquestación y estado de la app
│   ├── ingesta.js              # archivo → tabla cruda: delimitador, encoding, hoja, encabezados
│   ├── normalizacion.js        # limpieza de números y nombres, consolidación, agrupación
│   ├── motor-hhi.js            # ⭐ lógica pura: cuotas, IHH, ΔIHH, mercado post, CR4
│   ├── clasificador-fne.js     # ⭐ árbol de decisión del párrafo 35 y umbrales normativos
│   ├── umbrales-art48.js       # ⭐ umbrales de notificación del art. 48 DL 211
│   ├── ui-tabla.js             # tablas y paneles (solo DOM)
│   ├── ui-grafico.js           # gráfico de participación (Chart.js)
│   └── exportar.js             # informe HTML imprimible + CSV
├── test/                       # Vitest
└── datos-ejemplo/              # supermercados.csv, isapres.csv, sucio.csv (cárguelos con «Arrastre aquí su archivo»)
```

Los módulos marcados con ⭐ son lógica de negocio pura: no tocan el DOM, reciben datos y
devuelven datos. Son los que un tercero puede auditar sin leer el resto de la aplicación,
y son justamente aquellos donde un error tendría consecuencias jurídicas. Los umbrales
normativos están centralizados en `clasificador-fne.js` y `umbrales-art48.js`, no
dispersos por el código, para que actualizarlos ante un cambio de la guía sea trivial.

**Redondeo (RNF-04):** el cálculo no redondea en ningún paso intermedio. Redondear una
cuota antes de elevarla al cuadrado introduce un error que se amplifica al sumar y puede
mover el resultado a través de un umbral. Se redondea solo al pintar en pantalla.

---

## Alcance implementado

Todas las capacidades A1–A9 del plan (§3.1) y los requisitos funcionales RF-01 a RF-16:

- Carga de CSV/Excel por arrastre o selector, con autodetección de delimitador,
  codificación (incluido `windows-1252` de Excel Chile), hoja con datos y fila de
  encabezados, **más corrección manual de todo eso** por si la detección falla.
- Ingreso manual de datos y edición de los datos ya cargados, sin necesidad de archivo.
- Consolidación automática de razones sociales equivalentes y agrupación manual
  reversible de filiales bajo un agente económico.
- IHH pre, IHH post y ΔIHH; tabla auditable con columna Cuota² en vista antes y después
  de la operación; gráfico de participación.
- Doble indicador separado: nivel de concentración y veredicto FNE, con cita del numeral
  y avisos permanentes de los párrafos 32 y 36.
- Índices complementarios: CR4, número de agentes y competidores con cuota sobre un
  umbral ajustable.
- Comparador de escenarios de mercado relevante.
- Exportación de informe imprimible (con gráfico, supuestos, exclusiones, agrupaciones y
  filas descartadas) y de CSV.
- Verificador de los umbrales de notificación del art. 48 DL 211, con entradas propias y
  advertencia expresa de que no debe alimentarse con las ventas del mercado relevante.

### Fuera de alcance (declarado también en la interfaz)

IHH modificados para adquisiciones parciales o *joint ventures*; definición automática
del mercado relevante; análisis de efectos unilaterales o coordinados, eficiencias o
remedios; y cualquier juicio sobre las circunstancias especiales del párrafo 36.

> El verificador del art. 48 estaba listado en el plan como extensión futura (§12.1) y se
> adelantó a esta versión por su valor práctico. Es un cálculo independiente del análisis
> de IHH y puede retirarse sin afectar al resto.

---

## Licencias de terceros

Las librerías de `vendor/` se redistribuyen sin modificar, con sus avisos de copyright, y
quedan también incrustadas en `dist/Calculadora-IHH.html`:

| Librería | Versión | Licencia |
|---|---|---|
| [Papa Parse](https://github.com/mholt/PapaParse) | 5.4.1 | MIT |
| [SheetJS Community Edition](https://sheetjs.com) (`xlsx`) | 0.18.5 | Apache 2.0 |
| [Chart.js](https://www.chartjs.org) | 4.4.4 | MIT |

Los archivos de `datos-ejemplo/` son ficticios: las empresas y las cifras de ventas son
inventadas y no representan a ningún agente real.
