/**
 * Cómo paga cada empresa, para medir cuánto aporta por mes.
 *
 * Sale de la planilla "Ganancia Business por plan" del dueño del producto,
 * revisada el 2026-10-29. Hay dos formas de pagar:
 *
 * - **Fee**: la empresa paga un fijo por mes, use las sesiones que use.
 * - **Cupón**: el paciente entra con el cupón y, según el plan, la empresa
 *   paga una parte de cada sesión contra factura y el paciente el resto por la
 *   web. Los planes sin parte de la empresa son el caso más común: el
 *   paciente paga con descuento y listo.
 *
 * Lo que paga el paciente **está en la base** (`pacientes_pagos.monto`) y se
 * lee de ahí. Lo que paga la empresa y los fees **no están**: se facturan
 * aparte, así que viven acá, igual que el mapeo de `lib/empresas.ts`.
 *
 * Solo Uruguay: la planilla no tiene tarifas ni fees de Argentina, así que en
 * AR todo es cupón y cuenta lo que pagó el paciente.
 *
 * Los montos van **con IVA**, como figuran en la planilla, y en la moneda del
 * plan: `$` son pesos uruguayos, `U$S` dólares (Nearsure y Qubika). Son los
 * mismos códigos que `pacientes_pagos.moneda`, así la conversión pasa por el
 * mismo camino que el resto del tablero.
 *
 * Un cambio de tarifa se carga cambiando este archivo. Si alguna vez hace
 * falta que conviva la tarifa vieja con la nueva, se agrega vigencia; hoy no
 * la hay porque la planilla tampoco la tiene.
 */

export type Plan =
  | {
      tipo: "sesion";
      /** Lo que paga la EMPRESA por sesión. El paciente sale de la base. */
      online: number;
      presencial: number;
      moneda: "$" | "U$S";
    }
  | { tipo: "sin_cobro" }
  | {
      tipo: "fee";
      /** Cómo se nombra en la pantalla. */
      empresa: string;
      /** El fee de todos los meses, con IVA. */
      mensual: number;
      /** Los meses que se facturó otra cosa, 'YYYY-MM' → monto. */
      porMes?: Record<string, number>;
    };

/** El plan de un cupón de empresa que no tiene parte de la empresa. */
export const SOLO_CUPON = "cupon";

export const PLANES: Record<string, Plan> = {
  "100%": { tipo: "sesion", online: 1440, presencial: 1665, moneda: "$" },
  "50%": { tipo: "sesion", online: 760, presencial: 878.75, moneda: "$" },
  "35%": { tipo: "sesion", online: 560, presencial: 647.5, moneda: "$" },
  "30%": { tipo: "sesion", online: 480, presencial: 555, moneda: "$" },
  // La planilla lo marca para revisar: empresa y paciente suman menos que la
  // tarifa base. Queda como vino hasta que se corrija.
  "25%": { tipo: "sesion", online: 400, presencial: 462.5, moneda: "$" },
  Securitas: { tipo: "sesion", online: 912, presencial: 1054.5, moneda: "$" },
  Fosmetal: { tipo: "sesion", online: 1170, presencial: 1170, moneda: "$" },
  Gsoft: { tipo: "sesion", online: 760, presencial: 880, moneda: "$" },
  Nearsure: { tipo: "sesion", online: 36, presencial: 41.63, moneda: "U$S" },
  Qubika: { tipo: "sesion", online: 14, presencial: 16, moneda: "U$S" },

  // Alianzas y demos: son cupones, pero nadie paga la sesión.
  "sin cobro": { tipo: "sin_cobro" },

  "fee:ANII": { tipo: "fee", empresa: "ANII", mensual: 18000 },
  "fee:AXO": { tipo: "fee", empresa: "AXO (SiSi)", mensual: 15473 },
  "fee:Datalogic": { tipo: "fee", empresa: "Datalogic", mensual: 10164 },
  "fee:Fraylog": { tipo: "fee", empresa: "Fraylog", mensual: 29700 },
  "fee:GXC": {
    tipo: "fee",
    empresa: "GXC Consulting",
    mensual: 21457,
    porMes: { "2026-09": 25000, "2026-10": 25000 },
  },
  "fee:Greycon": { tipo: "fee", empresa: "Greycon", mensual: 3613 },
  "fee:Kinko": { tipo: "fee", empresa: "Kinko", mensual: 10000 },
  "fee:Nodum": {
    tipo: "fee",
    empresa: "Nodum",
    mensual: 8244,
    porMes: { "2026-10": 12500 },
  },
  "fee:Uruware": { tipo: "fee", empresa: "Uruware", mensual: 4856 },
  "fee:VSGLATAM": { tipo: "fee", empresa: "VSGLATAM", mensual: 2597 },
};

/**
 * De cupón a plan. Gana la primera regla que matchea, como en
 * `lib/empresas.ts`.
 *
 * `empresas` son nombres de `lib/empresas.ts`. `contiene` mira el nombre y el
 * código del cupón juntos, en minúscula: así se separan las empresas con dos
 * planes ("Big Cheese 100%" contra "Big Cheese"). Un cupón de empresa que no
 * cae en ninguna regla es `SOLO_CUPON`.
 */
type Regla = { empresas: string[]; contiene?: string[]; plan: string };

export const REGLAS: Regla[] = [
  // Nodum tiene fee y además un cupón especial que va como plan 100%.
  { empresas: ["Nodum"], contiene: ["50%"], plan: "100%" },

  { empresas: ["ANII"], plan: "fee:ANII" },
  { empresas: ["AXO", "SiSi"], plan: "fee:AXO" },
  { empresas: ["Datalogic"], plan: "fee:Datalogic" },
  { empresas: ["Fraylog"], plan: "fee:Fraylog" },
  { empresas: ["GXC Consulting"], plan: "fee:GXC" },
  { empresas: ["Greycon"], plan: "fee:Greycon" },
  { empresas: ["Kinko"], plan: "fee:Kinko" },
  { empresas: ["Nodum"], plan: "fee:Nodum" },
  { empresas: ["Uruware"], plan: "fee:Uruware" },
  { empresas: ["VSGLATAM"], plan: "fee:VSGLATAM" },

  { empresas: ["Securitas", "L'Oréal"], contiene: ["alianza"], plan: "sin cobro" },
  {
    empresas: ["ANCAP", "Aldeas Infantiles", "Audaca", "BESTSELLER", "UTE"],
    plan: "sin cobro",
  },

  { empresas: ["Securitas"], plan: "Securitas" },
  { empresas: ["Fosmetal"], plan: "Fosmetal" },
  { empresas: ["Gsoft"], plan: "Gsoft" },
  { empresas: ["Nearsure"], plan: "Nearsure" },
  { empresas: ["Qubika"], plan: "Qubika" },

  // Las que tienen dos planes: primero el cupón que dice 100%.
  {
    empresas: [
      "Big Cheese",
      "Catengril Country Club",
      "ISA",
      "INTERFASE",
      "Microlab",
      "Orangeloops",
      "Pase Libre",
    ],
    contiene: ["100%"],
    plan: "100%",
  },
  { empresas: ["Quanam"], contiene: ["35%", "familiar"], plan: "35%" },

  {
    empresas: ["ANDA", "Arcsona", "Afap Itaú", "L'Oréal", "Rootstrap", "Movigroup", "Sofka"],
    plan: "100%",
  },
  {
    // Applevel va en 50% aunque su cupón diga 100%: así vino en la planilla.
    empresas: [
      "Big Cheese",
      "Bosch y Cía",
      "Catengril Country Club",
      "Darnel",
      "ISA",
      "INTERFASE",
      "Kaizen",
      "Microlab",
      "Quanam",
      "Applevel",
    ],
    plan: "50%",
  },
  { empresas: ["Vairix"], plan: "35%" },
  { empresas: ["Pase Libre"], plan: "30%" },
  { empresas: ["Orangeloops"], plan: "25%" },
];

/**
 * El `CASE` que traduce cupón a plan, para correr dentro de MySQL.
 *
 * Por lo mismo que `sqlEmpresa()`: varias empresas emiten un cupón por
 * empleado con el nombre de esa persona, así que el nombre del cupón se
 * compara allá y de la base solo sale el nombre del plan.
 *
 * `alias` es una tabla derivada con dos columnas: `empresa` (lo que devolvió
 * `sqlEmpresa()`) y `texto` (nombre y código del cupón, en minúscula).
 */
export function sqlPlan(alias: string): string {
  const ramas = REGLAS.map((r) => {
    const empresa = `${alias}.empresa IN (${r.empresas.map(comillas).join(", ")})`;
    const texto = r.contiene
      ? ` AND (${r.contiene
          .map((t) => `LOCATE(${comillas(t)}, ${alias}.texto) > 0`)
          .join(" OR ")})`
      : "";
    return `WHEN ${empresa}${texto} THEN ${comillas(r.plan)}`;
  });
  return `CASE ${ramas.join("\n         ")} ELSE ${comillas(SOLO_CUPON)} END`;
}

/** Constantes de este archivo, pero L'Oréal tiene un apóstrofo. */
function comillas(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}
