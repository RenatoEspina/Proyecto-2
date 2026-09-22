// ejemplos.js — ARCHIVO GENERADO por build.js a partir de datos-ejemplo/*.csv.
// No editar a mano: los cambios se pierden en el próximo `npm run build`.
// Los datos van embebidos (y no se leen con fetch) para que la versión de archivo
// único funcione con doble clic, sin servidor.

export const EJEMPLOS = [
  {
    id: "supermercados",
    nombre: "Supermercados (archivo limpio)",
    archivo: "supermercados.csv",
    descripcion: "7 cadenas, CSV bien formado. Útil para ver el flujo completo sin ruido.",
    csv: "Nombre_Empresa,Ventas_Totales\nCencosud S.A.,4500000000\nWalmart Chile S.A.,4200000000\nSMU S.A.,2100000000\nTottus Chile S.A.,1200000000\nSupermercados Montserrat S.A.,650000000\nEkono S.A.,420000000\nSupermercado San Francisco Ltda.,180000000\n",
  },
  {
    id: "isapres",
    nombre: "Isapres (archivo limpio)",
    archivo: "isapres.csv",
    descripcion: "6 aseguradoras. Mercado más concentrado que el de supermercados.",
    csv: "Aseguradora,Ventas\nIsapre Consalud S.A.,980000000\nIsapre Banmédica S.A.,870000000\nIsapre Cruz Blanca S.A.,650000000\nIsapre Colmena Golden Cross S.A.,540000000\nIsapre Nueva Masvida S.A.,210000000\nIsapre Vida Tres S.A.,150000000\n",
  },
  {
    id: "sucio",
    nombre: "Cemento (archivo \"sucio\", como los reales)",
    archivo: "sucio.csv",
    descripcion: "Reproduce a propósito los defectos típicos: dos filas de título antes de la tabla, separador \";\", formato numérico chileno, símbolo $, nombres inconsistentes de una misma empresa, una filial que hay que agrupar a mano, una fila con ventas negativas y una fila de totales.",
    csv: "Informe interno - Mercado del Cemento 2025\nConfidencial - uso interno del estudio\nRazón Social;Ventas\nEMPRESA ALFA S.A.;\"$ 4.500.000\"\nEmpresa Alfa SA;1.200.000\nComercial Beta Ltda.;3.200.000,50\ncomercial beta ltda;800000\nDistribuidora Gamma SpA;1.800.000\nAlfa Retail SpA;500.000\nImportadora Delta S.A.;-200000\nCompetidor Épsilon Ltda.;950000\nProveedora Zeta Limitada;310000\n;\nTOTAL;12150000\n",
  },
];
