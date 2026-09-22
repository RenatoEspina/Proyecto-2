# Guía de uso — Calculadora IHH

**Para el equipo de Derecho. No se necesita ningún conocimiento técnico.**

Esta herramienta calcula el Índice Herfindahl-Hirschman (IHH) de un mercado a partir de
una planilla de ventas, y aplica el árbol de decisión del párrafo 35 de la *Guía para el
Análisis de Operaciones de Concentración Horizontales* de la FNE. Lo que antes tomaba
horas en Excel —y se perdía cada vez que se discutía la definición del mercado
relevante— toma segundos y se recalcula con un clic.

---

## 1. Cómo abrirla

**Haga doble clic en el archivo `Calculadora-IHH.html`.** Se abre en su navegador
(Chrome, Edge, Firefox o Safari) como cualquier página web.

- No hay que instalar nada.
- No hay que crear una cuenta.
- **Funciona sin internet.** Puede desconectar el computador de la red y seguirá
  funcionando igual.
- Puede copiar ese único archivo a un pendrive o enviarlo por correo a un colega.

> **Confidencialidad.** Todo el cálculo ocurre dentro de su navegador. El archivo de
> ventas que usted carga **no se sube a ningún servidor, no viaja por internet y no
> queda guardado en ninguna parte**. Por eso puede usarse con bases de ventas sujetas a
> confidencialidad ante la FNE y al secreto profesional.

En la esquina superior derecha hay un botón **«? ¿Cómo se usa?»** con esta misma
explicación resumida y un glosario, disponible en todo momento.

---

## 2. Qué archivo necesita

Un Excel (`.xlsx`, `.xls`) o un CSV con, al menos, **dos columnas**: el nombre de la
empresa y el monto de sus ventas.

```
Empresa                     Ventas
Cementos Bío Bío S.A.       4.500.000
Melón S.A.                  3.800.000
Polpaico S.A.               3.200.000
```

**No hace falta limpiar el archivo antes.** La herramienta se hace cargo sola de los
defectos habituales de los archivos que entregan las empresas:

| Lo que trae el archivo real | Qué hace la herramienta |
|---|---|
| Filas de título, logo o «confidencial» sobre la tabla | Las salta y encuentra la fila de encabezados |
| Varias hojas, con una portada al principio | Abre sola la hoja que contiene la tabla |
| Separador `;` en vez de `,` | Lo detecta |
| Montos como `$ 4.500.000` o `1.234.567,89` | Los interpreta en formato chileno |
| Acentos rotos (`Compa??a`) por venir de Excel Chile | Detecta la codificación y los corrige |
| La misma empresa escrita de varias formas (`EMPRESA ALFA S.A.` / `Empresa Alfa SA`) | Las suma en un solo agente y le avisa cuántas filas fusionó |
| Una fila `TOTAL` al final | La descarta (si no, el mercado se contaría dos veces) |
| Ventas negativas o celdas vacías | Las descarta y se las lista para que usted las revise |

Si aun así la lectura sale mal, abra **«¿La tabla se leyó mal?»**: ahí puede elegir a
mano la hoja del Excel, la fila de los títulos y qué columna es la de empresa y cuál la
de ventas. Debajo verá una vista previa con las columnas elegidas resaltadas en azul.

**¿No tiene archivo?** Use **«Escribir los datos a mano»**, si son pocas empresas.
También puede pegar dos columnas copiadas directamente desde Excel en la primera casilla.

**Para practicar**, la carpeta `datos-ejemplo/` trae tres archivos ficticios
(`supermercados.csv`, `isapres.csv` y `sucio.csv`, con empresas y cifras inventadas; este último con todos los defectos
anteriores). Cárguelos como cualquier otro archivo, arrastrándolos al recuadro.

---

## 3. Los tres pasos

### Paso 1 · Cargue las ventas

Arrastre el archivo al recuadro azul o haga clic para buscarlo.

Aparecerá una línea como:

> 📄 ventas_cemento_2025.xlsx · 47 filas leídas → 12 agentes económicos
> ⚠ 3 filas consolidadas en 1 empresa · 1 fila descartada

**Lea siempre esa advertencia.** Una fila mal descartada cambia el tamaño del mercado y,
con eso, todas las cuotas. Si algo está mal, use **«Revisar y corregir los datos a
mano»**: se abre una tabla editable con todas las empresas y también las filas
descartadas, para que corrija los montos usted mismo.

### Paso 2 · Defina el mercado y la operación

En la columna izquierda aparece cada agente económico con su cuota.

- **Destildar la casilla de la izquierda** saca a esa empresa del mercado relevante. Todo
  se recalcula al instante. Este es el corazón de la herramienta: cuando la FNE sostiene
  que determinado producto es sustituto y debe entrar al mercado, usted marca la casilla
  y ve el efecto inmediatamente, sin rehacer nada.
- **Marcar «⚖ se fusiona»** en dos o más empresas las identifica como las partes de la
  operación. Recién ahí aparecen el ΔIHH y el veredicto.
- **«Agrupar filiales de un mismo grupo…»** sirve cuando varias razones sociales son, en
  realidad, un solo agente económico bajo control común. Marque las que correspondan,
  póngale nombre al grupo y confirme. La herramienta **nunca agrupa sola**: determinar si
  existe control es una calificación jurídica suya, no un cálculo. Puede deshacer la
  agrupación cuando quiera.

### Paso 3 · Lea el resultado

Verá tres cifras y dos indicadores, que son cosas distintas y no deben confundirse.

**Las tres cifras**

| | Qué responde |
|---|---|
| **IHH pre-operación** | Cómo está el mercado hoy |
| **IHH post-operación** | Cómo quedaría si la operación se materializa |
| **ΔIHH** | Cuánto sube el índice *por efecto de la operación* |

**Los dos indicadores**

- **Nivel de concentración**: describe cómo queda el mercado (🟢 desconcentrado,
  🟡 moderado, 🔴 altamente concentrado). Es descriptivo.
- **Veredicto FNE**: aplica el párrafo 35 y dice si la operación caería en la zona de
  descarte (*safe harbour*) o requeriría análisis en profundidad.

> **Esto es lo más importante de entender:** el criterio de la FNE es **doble**. Mira el
> IHH post *y* el ΔIHH al mismo tiempo. Por eso un mercado 🔴 altamente concentrado puede
> perfectamente caer en la zona de descarte si la operación aporta una variación
> pequeña. Un semáforo que solo mirara el nivel daría una alarma falsa.

La regla completa, tal como la aplica la herramienta:

| IHH post-operación | Condición sobre el ΔIHH | Resultado |
|---|---|---|
| Menor a 1.500 | — | Descarte |
| Entre 1.500 y 2.500 | ΔIHH **menor a** 200 | Descarte |
| Entre 1.500 y 2.500 | ΔIHH igual o mayor a 200 | Análisis en profundidad |
| 2.500 o más | ΔIHH **menor a** 100 | Descarte |
| 2.500 o más | ΔIHH igual o mayor a 100 | Análisis en profundidad |

Los límites se tratan de forma conservadora: un ΔIHH de **exactamente** 200 **no** cae en
el safe harbour, porque el párrafo 36 habla de operaciones que «igualen o sobrepasen» los
umbrales.

Bajo cada veredicto aparece la cita del numeral que lo fundamenta, lista para copiar al
informe, más el recordatorio del párrafo 36 (circunstancias especiales) y del párrafo 32
(el IHH no es predictor único).

---

## 4. Cómo verificar el cálculo a mano

En **«Detalle del cálculo»**, la columna **Cuota²** es la cuota elevada al cuadrado. La
suma de esa columna es exactamente el IHH que muestra la herramienta. No es una caja
negra: puede auditarla línea por línea y mostrársela a la contraparte o al tribunal.

El botón **«Después de la operación»** muestra la misma tabla con las partes ya fundidas
en un solo agente, de modo que el IHH post también queda auditable.

Verificación rápida para dos partes: **ΔIHH = 2 × cuota₁ × cuota₂**. Con cuotas de 30 % y
20 %, el ΔIHH debe ser 2 × 30 × 20 = 1.200.

---

## 5. Comparar escenarios

El botón **«Guardar este escenario para comparar»** congela el resultado actual con el
nombre que usted le dé. Cambie la definición del mercado relevante, guarde otro, y la
tabla de escenarios los muestra uno al lado del otro.

Es exactamente la discusión que se da con la FNE: *«solo cemento gris»* frente a
*«cemento gris + hormigón premezclado»*. Los escenarios guardados se incluyen en el
informe exportado.

---

## 6. Exportar para el informe

- **«Exportar informe»** descarga un documento completo: las tres cifras, los dos
  indicadores con su cita normativa, la tabla de detalle antes y después de la operación,
  el gráfico, los escenarios comparados, las empresas excluidas, las agrupaciones que
  usted hizo, las filas descartadas y la lista de supuestos y limitaciones.
  **Para convertirlo a PDF:** ábralo y use *Imprimir → Guardar como PDF* (Ctrl+P, o ⌘+P
  en Mac). El texto queda seleccionable, así que puede copiar tablas al escrito.
- **«Exportar a Excel (CSV)»** descarga el detalle numérico para seguir trabajándolo.
  Está preparado para abrirse directamente en Excel en configuración regional chilena.

---

## 7. Complemento: ¿hay que notificar la operación?

Al final de la pantalla, el bloque **«¿Hay que notificar la operación a la FNE?»**
verifica los umbrales del art. 48 inciso 1°, letras a) y b), del DL 211, fijados por la
Resolución Exenta N° 157/2019 de la FNE: UF 2.500.000 conjuntas y UF 450.000
individuales en al menos dos de los agentes, requisitos copulativos.

⚠️ **Ese cálculo no usa los datos cargados arriba, y es deliberado.** El art. 48 se
refiere a las ventas **totales en Chile** de cada agente en *todos* los mercados en que
opere, no a sus ventas en el mercado relevante analizado. Por eso los montos se ingresan
aparte, junto con el valor de la UF al 31 de diciembre del ejercicio.

Cada agente se computa con su grupo empresarial. En una adquisición de control, del
lado vendedor cuentan solo las ventas del negocio adquirido, no las del vendedor.

Verifique siempre el valor de la UF y el ejercicio aplicable contra la fuente oficial.

---

## 8. Qué no hace esta herramienta

Esto no es una carencia del producto: es el límite entre lo computable y lo jurídico, y
conviene tenerlo presente al usarla y al defenderla.

- **No define el mercado relevante.** Calcula sobre el mercado que usted defina.
- **No evalúa las circunstancias especiales del párrafo 36** —competidor potencial o
  entrante reciente, agente *maverick*, competidores cercanos, vínculos estructurales o
  contractuales, estructura tendiente a la coordinación—. Ninguna de ellas es deducible
  de una planilla de ventas, y cualquiera puede llevar a la FNE a analizar en profundidad
  una operación que cae en la zona de descarte.
- **Solo cubre adquisiciones completas.** Para adquisiciones parciales y *joint ventures*
  la FNE usa índices IHH modificados (nota 50 de la Guía).
- **No analiza efectos unilaterales o coordinados, eficiencias ni remedios.**
- **No decide si existe control** entre matriz y filiales: ofrece agruparlas, nunca lo
  infiere.
- **No constituye asesoría legal.** Es un instrumento de tamizaje preliminar. El IHH no es
  un predictor único del desempeño competitivo del mercado (Guía FNE, párr. 32).

Y una advertencia que no depende del programa: **el resultado vale lo que valga el dato
de entrada**. Si la base de ventas está incompleta, o mide una variable inadecuada para
ese mercado (ventas en pesos cuando correspondía volumen o capacidad instalada), el
número será aritméticamente correcto y jurídicamente inútil.

---

## 9. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| «No se pudo identificar cuál columna tiene el nombre de la empresa» | Abra «¿La tabla se leyó mal?» y elija las columnas en los desplegables |
| Se leyó la hoja equivocada del Excel | En ese mismo panel, cambie la hoja en el desplegable «Hoja del Excel» |
| Los títulos de las columnas quedaron como datos | Cambie «Fila donde están los títulos de las columnas» |
| Una empresa aparece dos veces con nombres parecidos | Use «Agrupar filiales de un mismo grupo…» |
| Falta una empresa que sí debía estar | Revise el listado de filas descartadas; corrija con «Revisar y corregir los datos a mano» |
| No aparece el ΔIHH ni el veredicto | Faltan partes: marque «⚖ se fusiona» en al menos dos empresas |
| No se pudo leer el archivo | Ciérrelo en Excel e inténtelo de nuevo; verifique que sea `.csv`, `.xlsx` o `.xls` |
| Quiere partir de cero | Botón «Empezar de nuevo», arriba a la derecha |

---

*Prototipo académico · Proyecto Match Making (Derecho PUCV + Ingeniería Civil Informática
PUCV). Los umbrales normativos deben verificarse contra la versión vigente de las guías y
resoluciones de la FNE antes de cualquier uso real.*
