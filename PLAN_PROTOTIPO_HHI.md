# Plan de prototipo — Calculadora HHI para análisis de operaciones de concentración

**Proyecto:** Match Making (Derecho PUCV + Ingeniería Civil Informática PUCV)
**Contraparte de Derecho:** Felipe Carvajal Argandoña, 3er año
**Documento:** plan técnico-jurídico para construir el prototipo
**Fecha:** 22 de septiembre de 2026

---

## 1. Resumen ejecutivo

El equipo de Derecho necesita calcular el Índice Herfindahl-Hirschman (IHH/HHI) sobre bases de datos brutas de ventas para evaluar si una operación de concentración genera riesgos para la libre competencia. Hoy lo hacen a mano en Excel: es lento, frágil ante errores de decimales y, sobre todo, **no es reejecutable** cuando se discute la definición del mercado relevante (que es justamente donde se juega el caso).

La solución es una **aplicación web de cálculo** que reciba un archivo CSV/Excel de ventas, calcule cuotas de mercado, HHI pre y post operación, la variación ΔIHH, y aplique automáticamente los umbrales de la Guía de la FNE, permitiendo **recalcular en un clic** al incluir o excluir competidores del mercado relevante.

No requiere inteligencia artificial. La dificultad técnica real no está en la fórmula (es una suma de cuadrados), sino en tres puntos que el planteamiento inicial subestima:

1. **La limpieza y agregación de los datos brutos** (nombres de empresa inconsistentes, filiales que deben consolidarse bajo su matriz, formatos numéricos chilenos).
2. **El cálculo del ΔIHH**, que exige modelar *quiénes se fusionan*, no solo *cómo está el mercado*.
3. **La interactividad del mercado relevante**, que es el corazón del valor jurídico del producto.

---

## 2. Contexto normativo (verificado contra fuente oficial)

### 2.1 Marco legal

El **Decreto Ley N° 211** (texto refundido por el DFL N° 1 de 2005 del Ministerio de Economía) es la norma rectora en materia de libre competencia. Sus **artículos 47 y 48** establecen el sistema de control obligatorio y previo de operaciones de concentración ante la **Fiscalía Nacional Económica (FNE)**.

**Umbrales de notificación obligatoria** (Resolución Exenta N° 157/2019 de la FNE, vigente al momento de redacción — *verificar antes de la presentación*):

| Umbral | Monto | Definición |
|---|---|---|
| Conjunto | **UF 2.500.000** | Suma de las ventas en Chile de los agentes económicos que se concentran, en el ejercicio anterior a la notificación |
| Individual | **UF 450.000** | Ventas en Chile, por separado, de **al menos dos** de los agentes que se concentran, en el mismo período |

Ambos deben cumplirse copulativamente. La UF se toma al 31 de diciembre del período respectivo.

### 2.2 El índice HHI según la FNE

La **Guía para el Análisis de Operaciones de Concentración Horizontales** de la FNE (vigente desde el 31 de mayo de 2022, reemplaza a la Guía de 2012) establece en su sección B, párrafos 32 a 37:

> **Fórmula (nota al pie 49):** «El IHH se calcula sumando los cuadrados de las participaciones de mercado de los diversos actores **en términos porcentuales**.»

Es decir, con cuotas expresadas en puntos porcentuales (0–100), el índice va de ~0 (competencia atomizada) a **10.000** (monopolio).

> **Párrafo 35 — regla de descarte (*safe harbour*):** «por lo general, la FNE descartará un mayor análisis si, **con posterioridad a la Operación**, el índice de concentración del mercado es:
> i. Inferior a un IHH de 1500;
> ii. Superior a un IHH de 1500 e inferior a un IHH de 2500 (índice expresivo de un mercado moderadamente concentrado), **con una variación proyectada del IHH (o ΔIHH) menor a 200**; y
> iii. Superior a un IHH de 2500 (índice expresivo de un mercado altamente concentrado), **con una variación proyectada del IHH (o ΔIHH) menor a 100**.»

> **Párrafo 36:** la FNE analizará con mayor detención las operaciones que **igualen o sobrepasen** esos umbrales, o que —sin excederlos— presenten circunstancias especiales (competidor potencial o entrante reciente, agente *maverick*, competidores cercanos, vínculos estructurales o contractuales entre actores, estructura tendiente a la coordinación, reparos de consumidores, precedentes comparados, u otros indicios de riesgo).

> **Párrafo 32:** «Por regla general, la FNE **evitará considerar una determinada medida de concentración como el único predictor** del desempeño competitivo de un mercado.»

### 2.3 ⚠️ Corrección al planteamiento inicial

El documento base y la presentación describen el sistema como un semáforo de tres bandas sobre el HHI resultante (`<1500` verde, `1500–2500` amarillo, `>2500` rojo). **Eso es correcto como descripción de niveles de concentración, pero es insuficiente como regla de decisión regulatoria.** La guía condiciona el descarte a **dos variables simultáneas**: el HHI post-operación *y* el ΔIHH.

Consecuencia práctica: un mercado con HHI post de 3.000 (banda "roja") en el que la operación solo produce un ΔIHH de 40 **cae dentro del safe harbour** y la FNE normalmente descartará mayor análisis. Un semáforo que solo mire el nivel daría una alarma falsa y haría el producto inútil —o peor, engañoso— para el abogado.

**Por eso el prototipo debe calcular tres números, no uno:**

- `HHI_pre` — concentración del mercado **antes** de la operación.
- `HHI_post` — concentración **después**, sumando las cuotas de las partes que se concentran.
- `ΔIHH = HHI_post − HHI_pre` — el aporte de la operación.

Además, una nota al pie de la guía (n° 50) advierte que el IHH tradicional está diseñado para **fusiones o adquisiciones completas**; para adquisiciones parciales o *joint ventures* la FNE usa IHH modificados. El prototipo declara explícitamente que cubre el caso de adquisición completa (ver §11, limitaciones).

---

## 3. Alcance del prototipo

### 3.1 Dentro del alcance (MVP)

| # | Capacidad |
|---|---|
| A1 | Carga de archivo CSV o Excel con ventas por empresa |
| A2 | Limpieza y normalización de datos (formatos numéricos, duplicados, nombres) |
| A3 | Agregación de filas múltiples por empresa y agrupación manual de filiales bajo una matriz |
| A4 | Cálculo de tamaño de mercado, cuotas y HHI |
| A5 | Selección interactiva de las partes que se concentran → ΔIHH y HHI post |
| A6 | Inclusión/exclusión de competidores del mercado relevante con recálculo instantáneo |
| A7 | Clasificación automática según el párrafo 35 de la Guía FNE |
| A8 | Tabla ordenada de mayor a menor cuota + gráfico de participación |
| A9 | Exportación del resultado (tabla + gráfico + supuestos) para pegar en el informe |

### 3.2 Fuera del alcance (declarado explícitamente)

- IHH modificados para adquisiciones parciales o *joint ventures*.
- Definición automática del mercado relevante (es una decisión jurídica, no algorítmica).
- Análisis de efectos unilaterales o coordinados, eficiencias o remedios.
- Cualquier juicio sobre las "circunstancias especiales" del párrafo 36 (no son cuantificables).
- Verificación de los umbrales de notificación del art. 48 (candidato a fase 2, ver §12).

Esta frontera no es una debilidad del proyecto: es **precisamente el argumento del párrafo 32 de la guía**, y conviene presentarlo así en la defensa. La herramienta es un instrumento de tamizaje preliminar que libera tiempo del abogado para el análisis que sí requiere criterio jurídico.

---

## 4. Requisitos

### 4.1 Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Cargar archivo `.csv`, `.xlsx` o `.xls` mediante selector o arrastrar-y-soltar | Must |
| RF-02 | Detectar automáticamente las columnas de empresa y de ventas, permitiendo al usuario corregir el mapeo | Must |
| RF-03 | Consolidar filas repetidas de una misma empresa sumando sus ventas | Must |
| RF-04 | Permitir agrupar manualmente varias razones sociales bajo un mismo grupo empresarial | Should |
| RF-05 | Calcular ventas totales del mercado y cuota porcentual de cada actor | Must |
| RF-06 | Calcular `HHI_pre` | Must |
| RF-07 | Permitir marcar 2 o más empresas como "partes de la operación" | Must |
| RF-08 | Calcular `HHI_post` y `ΔIHH` | Must |
| RF-09 | Clasificar el resultado según el párrafo 35 de la Guía FNE, indicando si procede o no el descarte | Must |
| RF-10 | Mostrar el aviso del párrafo 36 (circunstancias especiales) cuando el resultado caiga en zona de descarte | Should |
| RF-11 | Activar/desactivar competidores individualmente y recalcular todo al instante | Must |
| RF-12 | Mostrar tabla ordenada descendente por cuota, con columna de cuota² | Must |
| RF-13 | Mostrar gráfico de participación de mercado | Must |
| RF-14 | Calcular índices complementarios CR4 y número de competidores significativos | Could |
| RF-15 | Exportar informe (PDF/PNG/CSV) con resultados, supuestos y empresas excluidas | Should |
| RF-16 | Cargar un dataset de ejemplo para demostración sin necesidad de archivo | Should |

### 4.2 No funcionales

| ID | Requisito |
|---|---|
| RNF-01 | **Confidencialidad: los datos no deben salir del equipo del usuario.** Las bases de ventas de una operación de concentración son información comercial sensible y frecuentemente están cubiertas por confidencialidad ante la FNE y por el secreto profesional del abogado. Procesamiento 100 % en el navegador, sin subida a servidor. |
| RNF-02 | Recálculo al cambiar el mercado relevante en menos de 200 ms para ≤ 5.000 filas |
| RNF-03 | Soporte de archivos de al menos 50.000 filas sin bloquear la interfaz |
| RNF-04 | Precisión: cálculo en punto flotante de doble precisión; redondeo **solo en la presentación**, nunca en los pasos intermedios |
| RNF-05 | Trazabilidad: toda cifra mostrada debe poder auditarse a partir de la tabla de detalle |
| RNF-06 | Funcionar sin conexión a internet una vez cargada la página |
| RNF-07 | Interfaz en español, con terminología jurídica correcta (IHH, mercado relevante, agente económico) |
| RNF-08 | Accesible desde navegador de escritorio moderno; no requiere instalación |

---

## 5. Reglas de negocio y fórmulas

### 5.1 Definiciones

Sea un mercado relevante con `n` empresas activas, donde `v_i` son las ventas (o facturación, volumen de importación, capacidad instalada, etc.) de la empresa `i`:

```
V     = Σ v_i                       (tamaño del mercado)
s_i   = (v_i / V) × 100             (cuota de mercado en puntos porcentuales)
HHI   = Σ (s_i)²                    (0 < HHI ≤ 10.000)
```

### 5.2 Operación de concentración

Sea `P` el conjunto de empresas que se concentran (|P| ≥ 2). Tras la operación, esas empresas pasan a ser una sola entidad con cuota `Σ_{i∈P} s_i`. Entonces:

```
HHI_post = HHI_pre − Σ_{i∈P}(s_i)² + (Σ_{i∈P} s_i)²

ΔIHH     = HHI_post − HHI_pre
         = (Σ_{i∈P} s_i)² − Σ_{i∈P}(s_i)²
         = 2 · Σ_{i<j ∈ P} s_i · s_j
```

Para el caso clásico de dos partes, esto se reduce a la fórmula conocida **ΔIHH = 2 · s₁ · s₂**. Es una buena verificación cruzada para el equipo de Derecho durante la demo.

> **Supuesto fuerte, debe declararse en la interfaz:** el cálculo asume que las cuotas de las partes se suman íntegramente y que ningún competidor reacciona (no hay reasignación de ventas, ni entrada, ni salida). Es el supuesto estándar del análisis estructural preliminar, no una proyección de mercado.

### 5.3 Árbol de decisión (párrafo 35 Guía FNE)

```
si HHI_post < 1500
    → DESCARTE. Mercado desconcentrado tras la operación.

si 1500 ≤ HHI_post < 2500
    si ΔIHH < 200 → DESCARTE. Mercado moderadamente concentrado, variación baja.
    si no         → ANÁLISIS EN PROFUNDIDAD.

si HHI_post ≥ 2500
    si ΔIHH < 100 → DESCARTE. Mercado altamente concentrado, variación baja.
    si no         → ANÁLISIS EN PROFUNDIDAD.
```

**Criterio de borde:** el párrafo 36 habla de operaciones que «igualen o sobrepasen» los umbrales, por lo que los límites se tratan de forma conservadora (`≥` activa el análisis). Un HHI post de exactamente 1500 con ΔIHH de exactamente 200 **no** cae en el safe harbour.

**Regla de presentación:** cuando el resultado caiga en zona de descarte, la interfaz debe mostrar igualmente el recordatorio del párrafo 36 (circunstancias especiales) y del párrafo 32 (el HHI no es predictor único). El semáforo informa; no concluye.

### 5.4 Semáforo (nivel de concentración) vs. veredicto (safe harbour)

Son dos indicadores distintos y deben mostrarse por separado para no inducir a error:

| Indicador | Qué responde | Valores |
|---|---|---|
| **Nivel de concentración** | ¿Cómo queda el mercado? | 🟢 Desconcentrado (<1500) · 🟡 Moderado (1500–2500) · 🔴 Altamente concentrado (≥2500) |
| **Veredicto FNE** | ¿La FNE descartaría mayor análisis? | ✅ Cae en zona de descarte · ⚠️ Requiere análisis en profundidad |

### 5.5 Casos borde del motor de cálculo

| Caso | Tratamiento |
|---|---|
| `V = 0` (todas las ventas cero o mercado vacío) | No calcular; mostrar error explicativo |
| Ventas negativas | Rechazar la fila y advertir (puede ser una devolución o un error de extracción; es decisión del abogado) |
| Ventas nulas / celda vacía | Tratar como 0, listar en un panel de "filas descartadas" |
| Una sola empresa | HHI = 10.000; advertir que un monopolio pre-existente no es un mercado analizable con esta herramienta |
| Menos de 2 partes seleccionadas | ΔIHH = 0; ocultar el bloque de veredicto y pedir seleccionar las partes |
| Todas las empresas excluidas del mercado relevante | Bloquear cálculo con mensaje claro |
| Una parte de la operación excluida del mercado relevante | Advertencia explícita: se está calculando un ΔIHH sin una de las partes |
| Empresa repetida tras normalizar nombres | Consolidar automáticamente y notificar cuántas filas se fusionaron |

---

## 6. Datos de entrada

### 6.1 Formato mínimo esperado

```csv
Nombre_Empresa,Ventas_Totales
Empresa Alfa S.A.,4500000
Comercial Beta Ltda.,3200000
Distribuidora Gamma SpA,1800000
Importadora Delta S.A.,500000
```

### 6.2 Realidad de los archivos que llegan (esto es el 60 % del esfuerzo)

Los archivos reales que entregan las empresas no vienen limpios. El módulo de ingesta debe resolver:

| Problema | Ejemplo | Solución |
|---|---|---|
| Separador decimal chileno | `1.234.567,89` | Detección de formato es-CL y normalización |
| Símbolo de moneda y espacios | `$ 4.500.000` | Limpieza con expresión regular |
| Codificación Latin-1 desde Excel Chile | `Compañía` → `Compa��a` | Detección de encoding, *fallback* a `windows-1252` |
| Separador de campos `;` en vez de `,` | CSV exportado desde Excel en configuración regional chilena | Autodetección del delimitador |
| Encabezados en la fila 3, con título y logo arriba | filas basura antes de la tabla | Detección de la fila de encabezado / selector manual |
| Nombres inconsistentes | `EMPRESA ALFA S.A.` / `Empresa Alfa SA` / `empresa alfa s.a` | Normalización: mayúsculas, sin tildes, sin sufijos societarios (`S.A.`, `SpA`, `Ltda.`, `Limitada`), colapso de espacios |
| Filiales de un mismo grupo | `Alfa Retail SpA`, `Alfa Distribución Ltda.` | **Agrupación manual** en la interfaz (es una calificación jurídica de control, no automatizable) |
| Fila de totales | `TOTAL, 10000000` | Detección heurística + confirmación del usuario |
| Columna con nombres distintos | `Empresa`, `Razón Social`, `Competidor`, `Marca` | Autodetección con lista de sinónimos + mapeo manual |

> **Nota jurídica relevante para la agrupación de filiales:** la unidad de análisis del DL 211 es el *agente económico*, no la razón social. Empresas bajo control común deben consolidarse. Determinar si existe control es una decisión del abogado, por lo que la herramienta ofrece la agrupación pero **nunca la infiere sola**. Esto es un punto fuerte para presentar: el diseño respeta el límite entre lo computable y lo jurídico.

### 6.3 Modelo de datos interno

```javascript
// Fila cruda tras el parseo
{ fila: 12, nombreOriginal: "EMPRESA ALFA S.A.", ventas: 4500000, valido: true }

// Actor consolidado
{
  id: "alfa",
  nombre: "Empresa Alfa S.A.",
  aliases: ["EMPRESA ALFA S.A.", "Alfa Retail SpA"],
  ventas: 5200000,
  incluido: true,        // pertenece al mercado relevante definido
  esParte: false         // participa en la operación de concentración
}

// Resultado del cálculo
{
  mercadoTotal: 10000000,
  actores: [{ id, nombre, ventas, cuota, cuotaCuadrado }],
  hhiPre: 3000,
  hhiPost: 4200,
  delta: 1200,
  nivel: "ALTAMENTE_CONCENTRADO",
  veredicto: "ANALISIS_PROFUNDIDAD",
  cr4: 100,
  excluidos: ["Importadora Delta S.A."]
}
```

---

## 7. Arquitectura y stack tecnológico

### 7.1 Recomendación: aplicación 100 % cliente (SPA sin backend)

```
┌──────────────────────── Navegador del abogado ────────────────────────┐
│                                                                       │
│   [Archivo .csv/.xlsx]                                                │
│          │                                                            │
│          ▼                                                            │
│   ┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌─────────┐  │
│   │  INGESTA    │──▶│ NORMALIZACIÓN│──▶│   MOTOR     │──▶│   UI    │  │
│   │ PapaParse / │   │  limpieza,   │   │   HHI       │   │ tabla,  │  │
│   │  SheetJS    │   │ consolidación│   │ (JS puro,   │   │ gráfico,│  │
│   └─────────────┘   └──────────────┘   │  0 deps)    │   │ semáforo│  │
│                                        └─────────────┘   └─────────┘  │
│                                                              │        │
│                                                              ▼        │
│                                                        [Informe]      │
│   ✅ Ningún dato sale del equipo                                      │
└───────────────────────────────────────────────────────────────────────┘
```

| Capa | Tecnología | Por qué |
|---|---|---|
| Base | HTML + CSS + JavaScript (ES modules), o React + Vite si el equipo lo prefiere | Sin instalación para el usuario final |
| Parseo CSV | [PapaParse](https://www.papaparse.com/) | Autodetección de delimitador y encoding, streaming |
| Parseo Excel | [SheetJS](https://sheetjs.com/) (`xlsx`) | Lee `.xlsx`/`.xls` en el navegador |
| Gráficos | [Chart.js](https://www.chartjs.org/) | Torta/barras, exportable a PNG con una línea |
| Motor HHI | JavaScript puro, sin dependencias | Es aritmética elemental; mantenerlo libre de dependencias lo hace testeable y auditable |
| Pruebas | [Vitest](https://vitest.dev/) o Jest | Pruebas unitarias sobre el motor (crítico: es la parte que no puede fallar) |
| Despliegue | GitHub Pages / Netlify (estático) | Gratis, URL para compartir con el equipo de Derecho |

**Razones de la recomendación:**

1. **Confidencialidad (RNF-01).** El argumento más potente frente al equipo de Derecho: los datos de ventas de una operación de concentración son información sensible. Que el archivo nunca salga del computador elimina de raíz el problema de custodia, y es un punto que se defiende muy bien en la presentación.
2. **Latencia cero en el recálculo.** El caso de uso estrella —"saquemos este sustituto y veamos qué pasa"— exige recálculo instantáneo. Con backend habría un viaje de red por cada ajuste.
3. **Cero infraestructura.** No hay servidor, base de datos, autenticación ni costos.
4. **Dificultad media-fácil**, como pedía el planteamiento.

### 7.2 Alternativa A — Python + Streamlit

Si el equipo domina Python y quiere construir más rápido: `pandas` para la ingesta, Streamlit para la interfaz. Se levanta un prototipo funcional en pocas horas. **Contra:** requiere ejecutar un servidor (local o en la nube); si es en la nube, los datos salen del equipo y hay que abordar el punto de confidencialidad.

### 7.3 Alternativa B — Backend FastAPI + frontend React

Solo si en el futuro se requiere persistencia de casos, usuarios, historial de escenarios o trabajo colaborativo entre abogados. **Es sobreingeniería para el MVP.** Mencionarla en la presentación como línea de evolución, no construirla ahora.

### 7.4 Estructura de archivos propuesta

```
calculadora-hhi/
├── index.html
├── src/
│   ├── main.js              # orquestación y estado de la app
│   ├── ingesta.js           # carga de archivo, detección de formato
│   ├── normalizacion.js     # limpieza de nombres y números, consolidación
│   ├── motor-hhi.js         # ⭐ lógica de negocio pura, sin DOM
│   ├── clasificador-fne.js  # ⭐ árbol de decisión del párrafo 35
│   ├── ui-tabla.js
│   ├── ui-grafico.js
│   └── exportar.js
├── test/
│   ├── motor-hhi.test.js
│   ├── clasificador-fne.test.js
│   └── normalizacion.test.js
├── datos-ejemplo/
│   ├── supermercados.csv
│   ├── sucio.csv            # con todos los defectos de §6.2
│   └── isapres.csv
└── README.md
```

> **Regla de diseño clave:** `motor-hhi.js` y `clasificador-fne.js` no deben tocar el DOM ni conocer la interfaz. Reciben datos, devuelven datos. Así se pueden probar exhaustivamente, y son justamente los módulos donde un error tendría consecuencias jurídicas.

### 7.5 Núcleo del motor (referencia de implementación)

```javascript
// motor-hhi.js  — lógica pura, sin dependencias

export function calcularCuotas(actores) {
  const total = actores.reduce((acc, a) => acc + a.ventas, 0);
  if (total <= 0) throw new Error('El tamaño del mercado debe ser mayor a cero.');
  return actores.map(a => ({ ...a, cuota: (a.ventas / total) * 100 }));
}

export function hhi(cuotas) {
  return cuotas.reduce((acc, s) => acc + s * s, 0);
}

export function analizarOperacion(actores, idsPartes) {
  const conCuota = calcularCuotas(actores);
  const cuotas   = conCuota.map(a => a.cuota);
  const hhiPre   = hhi(cuotas);

  const partes      = conCuota.filter(a => idsPartes.includes(a.id));
  const sumaPartes  = partes.reduce((acc, a) => acc + a.cuota, 0);
  const sumaCuadr   = partes.reduce((acc, a) => acc + a.cuota ** 2, 0);

  const delta   = sumaPartes ** 2 - sumaCuadr;   // 0 si hay menos de 2 partes
  const hhiPost = hhiPre + delta;

  return { hhiPre, hhiPost, delta, actores: conCuota, mercadoTotal: /* ... */ };
}
```

```javascript
// clasificador-fne.js — Guía FNE Operaciones de Concentración Horizontales (2022), párr. 35

export function nivelConcentracion(hhiPost) {
  if (hhiPost < 1500) return 'DESCONCENTRADO';
  if (hhiPost < 2500) return 'MODERADAMENTE_CONCENTRADO';
  return 'ALTAMENTE_CONCENTRADO';
}

export function veredictoFNE(hhiPost, delta) {
  if (hhiPost < 1500)                   return 'DESCARTE';
  if (hhiPost < 2500 && delta < 200)    return 'DESCARTE';
  if (hhiPost >= 2500 && delta < 100)   return 'DESCARTE';
  return 'ANALISIS_PROFUNDIDAD';
}
```

**Nota sobre el redondeo (RNF-04):** nunca redondear las cuotas antes de elevarlas al cuadrado. Redondear `s_i` a dos decimales y luego calcular introduce un error que se amplifica al cuadrar y sumar, y puede mover el resultado a través de un umbral. Se redondea únicamente al pintar en pantalla.

---

## 8. Diseño de la interfaz

### 8.1 Flujo del usuario

```
1. Cargar archivo  →  2. Confirmar mapeo de columnas  →  3. Revisar datos limpios
                                                              │
                                                              ▼
6. Exportar informe  ←  5. Ajustar mercado relevante  ←  4. Marcar partes de la operación
                              ↑______ recálculo instantáneo ______│
```

### 8.2 Pantalla principal (wireframe)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Calculadora IHH · Análisis de operaciones de concentración              │
├──────────────────────────────────────────────────────────────────────────┤
│  📄 ventas_mercado_cemento_2025.xlsx   ·  47 filas → 12 agentes          │
│     ⚠ 3 filas consolidadas · 1 fila descartada (ventas negativas)  [ver] │
├───────────────────────────────┬──────────────────────────────────────────┤
│  MERCADO RELEVANTE            │   RESULTADO                              │
│  ┌──────────────────────────┐ │   ┌────────────────────────────────────┐ │
│  │ ☑ Alfa S.A.       38,2 % │ │   │  IHH pre-operación        2.145    │ │
│  │   └ ⚖ parte de la op.    │ │   │  IHH post-operación       2.960    │ │
│  │ ☑ Beta Ltda.      24,1 % │ │   │  ΔIHH                       815    │ │
│  │   └ ⚖ parte de la op.    │ │   └────────────────────────────────────┘ │
│  │ ☑ Gamma SpA       18,7 % │ │                                          │
│  │ ☑ Delta S.A.      12,4 % │ │   🔴 Mercado altamente concentrado       │
│  │ ☐ Épsilon (excl.)  6,6 % │ │   ⚠️  Requiere análisis en profundidad   │
│  │   ...                    │ │      ΔIHH 815 ≥ 100 en mercado con       │
│  └──────────────────────────┘ │      IHH ≥ 2500 (Guía FNE, párr. 35.iii) │
│  Tamaño del mercado:          │                                          │
│  $ 84.320.500.000             │   ┌────────────────────────────────────┐ │
│                               │   │      [gráfico de participación]    │ │
│  [Seleccionar todos]          │   └────────────────────────────────────┘ │
│  [Agrupar filiales…]          │                                          │
├───────────────────────────────┴──────────────────────────────────────────┤
│  DETALLE                                              [Exportar informe] │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ #  Agente económico    Ventas         Cuota    Cuota²   Parte op.    ││
│  │ 1  Alfa S.A.           32.210.431.000  38,20 % 1.459,24    ⚖         ││
│  │ 2  Beta Ltda.          20.321.240.500  24,10 %   580,81    ⚖         ││
│  │ 3  Gamma SpA           15.768.133.500  18,70 %   349,69               ││
│  │ …                                                                     ││
│  │    TOTAL               84.320.500.000 100,00 % 2.145,32  ← IHH pre    ││
│  └──────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Principios de interfaz

- **La columna Cuota² debe ser visible.** Es lo que convierte la caja negra en una herramienta auditable: el abogado ve que la suma de esa columna es el HHI. Genera confianza y sirve para explicar el método a un tercero.
- **Separar visualmente nivel de concentración y veredicto FNE** (§5.4). Son dos afirmaciones distintas.
- **Citar la norma en la interfaz.** Cada veredicto debe indicar el numeral de la guía que lo fundamenta; el abogado necesita poder trazar la cita a su informe.
- **El panel de datos descartados nunca se oculta.** Si la herramienta descartó filas, el usuario debe poder revisarlas: una fila mal descartada altera el tamaño del mercado y con ello todas las cuotas.
- **Todo cambio recalcula al instante.** No usar botón "Calcular"; el valor del producto está en la inmediatez de la exploración de escenarios.

---

## 9. Plan de implementación

Cinco fases. Al final de cada una hay algo demostrable.

> **Estado al 22-09-2026:** las fases 1 a 4 están implementadas y verificadas; el
> prototipo entregable es `calculadora-hhi/dist/Calculadora-IHH.html`, un archivo único
> que se abre con doble clic (ver `calculadora-hhi/GUIA_DE_USO.md`). Quedan pendientes
> la fase 0 —conseguir archivos de ventas reales y responder las preguntas de §13— y la
> fase 5, que dependen del equipo de Derecho. Respecto de §12, el verificador de
> umbrales del art. 48 se adelantó a esta versión como bloque independiente.

### Fase 0 — Preparación (antes de escribir código)

- [ ] Crear el repositorio Git y definir convenciones mínimas.
- [ ] **Conseguir 2 o 3 archivos de ventas reales o realistas** con el equipo de Derecho. Es el insumo más importante y el que más suele demorarse; pedirlo primero.
- [ ] Validar con Derecho las tres preguntas abiertas de §13.
- [ ] Construir un archivo de prueba "sucio" que reproduzca los defectos de §6.2.

### Fase 1 — Motor de cálculo (el núcleo)

- [x] `motor-hhi.js`: cuotas, HHI, ΔIHH, HHI post.
- [x] `clasificador-fne.js`: árbol de decisión del párrafo 35.
- [x] Batería de pruebas unitarias con los casos de §10.
- [x] Manejo de todos los casos borde de §5.5.

*Demostrable:* pruebas en verde mostrando los números de la guía reproducidos exactamente.

### Fase 2 — Ingesta y normalización

- [x] Carga de archivo (selector + arrastrar y soltar).
- [x] Parseo CSV con autodetección de delimitador y encoding.
- [x] Parseo Excel.
- [x] Detección y mapeo manual de columnas.
- [x] Normalización numérica (formato chileno, símbolos de moneda).
- [x] Normalización de nombres y consolidación de duplicados.
- [x] Panel de filas descartadas y advertencias.

*Demostrable:* cargar el archivo sucio y obtener una tabla limpia y correcta.

### Fase 3 — Interfaz y explorador de escenarios

- [x] Tabla de resultados ordenada, con columna Cuota².
- [x] Casillas de inclusión/exclusión del mercado relevante.
- [x] Marcado de partes de la operación.
- [x] Panel de resultados con los tres índices.
- [x] Doble indicador: nivel de concentración + veredicto FNE, con cita normativa.
- [x] Gráfico de participación.
- [x] Agrupación manual de filiales.

*Demostrable:* la herramienta completa, funcionando de punta a punta.

### Fase 4 — Salida y pulido

- [x] Exportar informe con tabla, gráfico, supuestos y lista de exclusiones.
- [x] Dataset de ejemplo cargable con un clic (esencial para la presentación).
- [x] Textos de advertencia y limitaciones (§11).
- [x] Manejo de errores con mensajes en lenguaje claro.
- [x] Despliegue en una URL pública.

### Fase 5 — Validación con el equipo de Derecho

- [ ] Sesión de prueba: que el abogado reproduzca un caso que ya calculó a mano y se comparen resultados. **Este es el verdadero criterio de aceptación del proyecto.**
- [ ] Ajustes de terminología jurídica.
- [ ] Preparación de la demo conjunta (§14).

---

## 10. Casos de prueba

Todos verificables a mano, para que el equipo de Derecho pueda auditar el motor.

| # | Entrada (ventas) | Partes | HHI pre | ΔIHH | HHI post | Nivel | Veredicto |
|---|---|---|---|---|---|---|---|
| T1 | 250, 250, 250, 250 | — | 2.500 | 0 | 2.500 | 🔴 Alto | ✅ Descarte (Δ < 100) |
| T2 | 400, 300, 200, 100 | B+C | 3.000 | 1.200 | 4.200 | 🔴 Alto | ⚠️ Análisis |
| T3 | 1.000 (única empresa) | — | 10.000 | 0 | 10.000 | 🔴 Alto | Advertencia: monopolio |
| T4 | 100 empresas de 10 c/u | — | 100 | 0 | 100 | 🟢 Desconcentrado | ✅ Descarte |
| T5 | 1, 1, 1 | — | 3.333,33 | 0 | 3.333,33 | 🔴 Alto | ✅ Descarte |
| T6 | 300, 300, 200, 200 | C+D | 2.600 | 800 | 3.400 | 🔴 Alto | ⚠️ Análisis |
| T7 | 200,200,200,200,100,100 | E+F | 1.800 | 200 | 2.000 | 🟡 Moderado | ⚠️ Análisis (Δ = 200, no < 200) |
| T8 | 200,200,200,200,150,50 | E+F | 1.850 | 150 | 2.000 | 🟡 Moderado | ✅ Descarte |
| T9 | 0, 0, 0 | — | — | — | — | — | Error: mercado de tamaño cero |
| T10 | 500, −100, 300 | — | — | — | — | — | Fila negativa descartada + advertencia |

**Verificación de T2 (para mostrar en la demo):**
Cuotas pre: 40 / 30 / 20 / 10 → HHI = 1.600 + 900 + 400 + 100 = **3.000**
ΔIHH por fórmula: 2 × 30 × 20 = **1.200**
Cuotas post: 40 / 50 / 10 → HHI = 1.600 + 2.500 + 100 = **4.200** ✓
3.000 + 1.200 = 4.200 ✓

**T7 es el caso más importante de todos:** está exactamente en el límite. Es el que demuestra que se entendió que el criterio es "menor a 200" y no "menor o igual a 200", y es el tipo de precisión que distingue un prototipo serio.

---

## 11. Riesgos y limitaciones

### 11.1 Limitaciones que la herramienta debe declarar en pantalla

1. **El IHH no es predictor único.** Guía FNE párr. 32: la FNE evitará considerar una medida de concentración como único predictor del desempeño competitivo. La herramienta es tamizaje preliminar.
2. **No evalúa las circunstancias especiales del párrafo 36.** Competidor potencial, agente *maverick*, cercanía competitiva, vínculos estructurales o contractuales, historial de coordinación: nada de eso es computable desde una planilla de ventas, y cualquiera de ellas puede llevar a la FNE a analizar en profundidad una operación que cae en el safe harbour.
3. **Solo cubre adquisiciones completas.** Para adquisiciones parciales y *joint ventures*, la FNE usa IHH modificados (nota 50 de la guía). Fuera del MVP.
4. **La definición del mercado relevante es del abogado.** La herramienta calcula sobre el mercado que el usuario defina; no lo define ni lo valida.
5. **Depende íntegramente de la calidad del dato de entrada.** Si la base de ventas está incompleta o mide una variable inadecuada (ventas vs. volumen vs. capacidad), el resultado es aritméticamente correcto y jurídicamente inútil.
6. **No constituye asesoría legal.** Debe figurar como aviso permanente en la interfaz y en el informe exportado.

### 11.2 Riesgos del proyecto

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Falso sentido de certeza: el abogado toma el semáforo como conclusión | **Alto** | Separar nivel y veredicto (§5.4); avisos del párr. 36 siempre visibles; lenguaje "la FNE normalmente descartaría", nunca "la operación es legal" |
| Error de redondeo cruza un umbral | Alto | RNF-04: redondeo solo en presentación; pruebas T5 y T7 |
| Los umbrales de la guía cambian | Medio | Centralizar los números en un módulo de configuración con la fecha y versión de la guía; no dispersarlos por el código |
| Archivos reales mucho más sucios de lo previsto | Medio | Conseguir archivos reales en Fase 0, no al final |
| Sobrealcance (querer hacer análisis de efectos, IA, etc.) | Medio | §3.2 es vinculante; lo demás va a §12 |
| Filtración de datos comerciales sensibles | Alto | RNF-01: arquitectura sin servidor; no agregar analítica ni telemetría |
| Desalineación entre ambos equipos sobre qué se entrega | Medio | Fase 5 con reproducción de un caso calculado a mano |

---

## 12. Extensiones futuras (fase 2 del producto)

Mencionarlas en la presentación demuestra visión, pero **no construirlas ahora**.

1. **Verificador de umbrales de notificación (art. 48 DL 211).** Dadas las ventas en Chile de los agentes que se concentran y el valor de la UF al 31 de diciembre, determinar si la operación debe notificarse obligatoriamente (UF 2.500.000 conjunto + UF 450.000 individual en al menos dos de ellos). Es un cálculo simple y de altísimo valor práctico: responde a la primera pregunta que se hace un abogado en cualquier operación.
2. **Comparador de escenarios lado a lado.** Guardar y comparar varias definiciones de mercado relevante (ej. "solo cemento gris" vs. "cemento gris + hormigón premezclado"), que es exactamente la discusión que se da con la FNE.
3. **Índices complementarios.** CR4, número de competidores significativos (footnote 48 de la guía), índice de dominancia.
4. **IHH modificados** para adquisiciones parciales y *joint ventures*.
5. **Series temporales.** Evolución del HHI del mercado en varios años, para acreditar dinamismo o estabilidad de las cuotas.
6. **Generación del informe en Word** con la estructura que usa el estudio.
7. **Persistencia de casos** (requeriría backend y, con ello, la discusión de confidencialidad del §7.1).

---

## 13. Preguntas abiertas para el equipo de Derecho

Deben resolverse en Fase 0; cambian decisiones de diseño:

1. **¿Qué variable mide el mercado en los casos que trabajan?** ¿Ventas en pesos, unidades, volumen de importación, capacidad instalada? Determina qué unidades y formatos debe soportar la ingesta.
2. **¿Cuántas partes suelen concentrarse?** ¿Siempre dos, o hay casos de tres o más? El motor ya lo generaliza, pero la interfaz de selección cambia.
3. **¿Necesitan comparar escenarios de mercado relevante simultáneamente, o basta con ajustar uno e ir viendo?** Es la diferencia entre el MVP y la extensión n° 2.
4. **¿El informe exportado debe seguir algún formato particular del estudio o de la FNE?**
5. **¿Con qué frecuencia trabajan con filiales que deben consolidarse bajo una matriz?** Determina cuánto esfuerzo poner en RF-04.

---

## 14. Guion de la demostración conjunta

Una secuencia de cinco minutos que muestra el valor del producto y el trabajo interdisciplinario:

1. **El problema (Derecho, 45 s).** Mostrar el Excel real con miles de filas. "Esto es lo que recibimos. Calcular el HHI a mano toma horas y un decimal mal puesto invalida el análisis."
2. **La carga (Ingeniería, 30 s).** Arrastrar ese mismo archivo. Aparecen 12 agentes consolidados, 3 filas fusionadas, 1 descartada. "Lo que tomaba horas: tres segundos."
3. **El cálculo (Ingeniería, 45 s).** Mostrar la tabla con la columna Cuota². "La suma de esta columna es el HHI. No es una caja negra: se puede auditar línea por línea."
4. **El momento clave (Derecho, 90 s).** "La FNE nos objeta la definición del mercado relevante: sostiene que este producto es sustituto y debe entrar." Marcar la casilla. Los tres índices y el veredicto cambian al instante. **Este es el momento que vende el producto**, porque es exactamente el trabajo que hoy obliga a rehacer todo desde cero.
5. **El matiz que demuestra rigor (ambos, 60 s).** Mostrar un caso en zona roja pero con ΔIHH bajo: mercado altamente concentrado y, aun así, dentro del safe harbour de la FNE. "Nuestra primera versión del planteamiento clasificaba solo por el nivel de concentración; al ir a la guía vigente descubrimos que el criterio es doble. La herramienta lo refleja." Es el mejor argumento de que hubo trabajo conjunto real y no dos entregables pegados.
6. **Los límites (Derecho, 30 s).** Párrafos 32 y 36: la herramienta descarta o alerta, no concluye. El criterio jurídico sigue siendo del abogado; lo que se elimina es el trabajo ofimático.

---

## 15. Glosario

| Término | Definición |
|---|---|
| **Operación de concentración** | Acto que produce que dos o más agentes económicos previamente independientes cesen su independencia (fusión, adquisición de control, *joint venture*, adquisición de activos). Arts. 47 y ss. DL 211 |
| **Mercado relevante** | Conjunto de productos y zona geográfica dentro de los cuales se evalúa el poder de mercado. Su definición es la decisión jurídica más determinante del análisis |
| **Agente económico** | Unidad de análisis del DL 211; puede comprender varias razones sociales bajo control común |
| **IHH / HHI** | Índice Herfindahl-Hirschman: suma de los cuadrados de las cuotas de mercado en puntos porcentuales. Rango 0–10.000 |
| **ΔIHH** | Variación del IHH producida por la operación. Para dos partes: 2·s₁·s₂ |
| **Safe harbour** | Zona de descarte: umbrales bajo los cuales la FNE normalmente no profundiza el análisis (párr. 35 de la Guía) |
| **Maverick** | Competidor atípico, habitualmente pequeño, que actúa con independencia de los líderes y ejerce presión competitiva efectiva (nota 52 de la Guía) |
| **CR4** | Suma de las cuotas de las cuatro empresas más grandes; índice de concentración complementario |
| **FNE** | Fiscalía Nacional Económica |
| **TDLC** | Tribunal de Defensa de la Libre Competencia |
| **UF** | Unidad de Fomento, unidad de cuenta reajustable usada para los umbrales del art. 48 |

---

## 16. Fuentes

- [Guía para el Análisis de Operaciones de Concentración Horizontales, FNE (mayo 2022)](https://www.fne.gob.cl/wp-content/uploads/2021/05/Guia-para-el-Analisis-de-Operaciones-de-Concentracion-Horizontales-mayo-VF.pdf) — **fuente principal**; párrafos 32 a 37 y notas 47 a 52
- [Guía Interna para el Análisis de Operaciones de Concentración Horizontal — FNE](https://www.fne.gob.cl/guia-1/)
- [Guía Práctica para la Aplicación de Umbrales de Notificación de Operaciones de Concentración, FNE](https://www.fne.gob.cl/wp-content/uploads/2025/06/Guia_Umbrales_2019.pdf)
- [Decreto Ley N° 211, versión refundida — FNE](https://www.fne.gob.cl/wp-content/uploads/2010/12/DL_211_refundido_2016.pdf)
- [Índice de Herfindahl-Hirschman (HHI) — CeCo, Universidad Adolfo Ibáñez](https://centrocompetencia.com/en/hhi/)
- [Todo sobre la nueva Guía de operaciones de concentración de la FNE — CeCo](https://centrocompetencia.com/nueva-guia-operaciones-concentracion-fne/)
- Documentos base del proyecto: `Proyecto Match Making_ Calculadora automatizada del índice HHI…docx` y `Match Making.pptx`

> **Advertencia:** los umbrales normativos y montos en UF deben verificarse contra la versión vigente de las guías y resoluciones de la FNE antes de cualquier uso real. Este documento refleja el estado de las fuentes consultadas a la fecha indicada.
