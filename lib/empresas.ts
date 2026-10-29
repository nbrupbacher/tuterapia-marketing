/**
 * Qué empresa hay detrás de cada cupón.
 *
 * La base no lo dice: `cupones` es id, codigo, nombre, pais, fecha, los
 * límites, el porcentaje y activo. No hay columna de tipo ni de cliente. Lo
 * único que lo dice es cómo se llama el cupón, así que esto es un mapeo a
 * mano, revisado con el dueño del producto el 2026-10-29, igual que
 * `marketing.utm_mapping`.
 *
 * **Nunca sale un nombre de persona de acá.** Varias empresas emiten un cupón
 * por empleado y le ponen su nombre —son pacientes en tratamiento—. Los
 * patrones agarran el prefijo de la empresa y el `CASE` devuelve la empresa:
 * el `nombre` del cupón se usa adentro de MySQL para comparar y no viaja a
 * Supabase ni a la pantalla.
 *
 * El orden importa: gana el primero que matchea. Por eso Fosmetal va antes que
 * ISA (un apellido con "isa" adentro caía en ISA) y Fraylog antes que Pase
 * Libre (su nombre es "Fraylog (Pase Libre)").
 */

export type Empresa = {
  nombre: string;
  /** Patrones LIKE, en minúscula, contra `cupones.nombre`. */
  porNombre?: string[];
  /** Patrones LIKE, en minúscula, contra `cupones.codigo`. */
  porCodigo?: string[];
  /** De qué empresa madre cuelga, cuando cuelga de una. */
  grupo?: string;
};

/**
 * Las 61 empresas, de la más específica a la más general.
 *
 * Vesta es un grupo: sus siete cupones nombran empresas distintas, y el dueño
 * del producto pidió nombrarlas por su nombre con Vesta al costado, no
 * juntarlas en "VESTA".
 */
export const EMPRESAS: Empresa[] = [
  // Primero los que tienen que ganarle a un patrón más ancho.
  { nombre: "Fosmetal", porNombre: ["fosmeta%", "fomsetal%"] },
  { nombre: "Fraylog", porNombre: ["fraylog%"] },

  // El grupo Vesta, cada una por su nombre.
  { nombre: "GXC Consulting", grupo: "Vesta", porNombre: ["vesta gxc%"] },
  { nombre: "Nodum", grupo: "Vesta", porNombre: ["vesta nodum%"] },
  { nombre: "Datalogic", grupo: "Vesta", porNombre: ["vesta datalogic%"] },
  { nombre: "Uruware", grupo: "Vesta", porNombre: ["vesta uruware%"] },
  { nombre: "VSGLATAM", grupo: "Vesta", porNombre: ["vsglatam%"] },
  { nombre: "Gsoft", grupo: "Vesta", porNombre: ["vesta gsoft%"] },
  { nombre: "Greycon", grupo: "Vesta", porNombre: ["vesta greycon%"] },

  // El resto. Los cupones "particular" de una empresa son la misma empresa.
  { nombre: "Farmashop", porNombre: ["%farmashop%"] },
  { nombre: "TCS", porNombre: ["%tcs%"] },
  { nombre: "UTEC", porNombre: ["%utec%"] },
  { nombre: "UTE", porNombre: ["demo ute%"] },
  { nombre: "December Labs", porNombre: ["%december labs%"] },
  { nombre: "Galicia", porNombre: ["%galicia%"] },
  { nombre: "L'Oréal", porCodigo: ["#loreal%", "#alianzaloreal%"] },
  { nombre: "AXO", porNombre: ["%axo%"] },
  { nombre: "Kinko", porNombre: ["%kinko%"] },
  { nombre: "USAL", porNombre: ["%usal%"] },
  { nombre: "Arcsona", porNombre: ["%arcsona%"] },
  { nombre: "Globant", porNombre: ["%globant%"] },
  { nombre: "Pilay", porNombre: ["%pilay%"] },
  { nombre: "Big Cheese", porNombre: ["%big cheese%", "%bigcheese%"] },
  { nombre: "TaTa", porCodigo: ["#tata%"] },
  { nombre: "Kaizen", porNombre: ["%kaizen%"] },
  { nombre: "SiSi", porCodigo: ["#bienestarsisi%"] },
  { nombre: "ANII", porNombre: ["%anii%"] },
  { nombre: "ANCAP", porNombre: ["%ancap%"] },
  { nombre: "Quanam", porNombre: ["%quanam%"] },
  { nombre: "Orangeloops", porNombre: ["%orangeloops%"] },
  { nombre: "Catengril Country Club", porNombre: ["%catengril%", "%ccc%"] },
  { nombre: "Afap Itaú", porNombre: ["%afap%"] },
  { nombre: "Vairix", porNombre: ["%vairix%"] },
  { nombre: "Manpower", porNombre: ["%manpower%"] },
  { nombre: "WILD FI", porNombre: ["%wild fi%"] },
  { nombre: "Chic Parisien", porNombre: ["%chic parisien%"] },
  { nombre: "Securitas", porNombre: ["%securitas%"] },
  { nombre: "ISA", porNombre: ["isa - %"], porCodigo: ["%isa%"] },
  { nombre: "BESTSELLER", porNombre: ["%bestseller%"] },
  { nombre: "Rootstrap", porNombre: ["%rootstrap%"] },
  { nombre: "Applevel", porNombre: ["%applevel%"] },
  { nombre: "Movigroup", porNombre: ["%movigroup%"] },
  { nombre: "Coderhouse", porNombre: ["%coderhouse%"] },
  { nombre: "Flix", porNombre: ["flix%"] },
  { nombre: "Microlab", porNombre: ["%microlab%"] },
  { nombre: "Sofka", porNombre: ["%sofka%"] },
  { nombre: "Darnel", porNombre: ["%darnel%"] },
  { nombre: "Bosch y Cía", porNombre: ["%bosch%"] },
  { nombre: "Aldeas Infantiles", porNombre: ["%aldeas%"] },
  { nombre: "Gómez Platero", porNombre: ["%platero%"] },
  { nombre: "ANDA", porCodigo: ["#anda%"] },
  { nombre: "FOCUS", porCodigo: ["#bienestarfocus%"] },
  { nombre: "Pedidos Ya", porNombre: ["%pedidos ya%"] },
  { nombre: "Maslow", porNombre: ["%maslow%"] },
  { nombre: "HCA", porCodigo: ["#bienestarhca%"] },
  { nombre: "INTERFASE", porNombre: ["%interfase%"] },
  { nombre: "Cedarcode", porNombre: ["%cedarcode%"] },
  { nombre: "Nearsure", porNombre: ["%nearsure%"] },
  { nombre: "Audaca", porNombre: ["%audaca%"] },
  { nombre: "Bonprole", porNombre: ["%bonprole%"] },
  { nombre: "HSBC", porNombre: ["%hsbc%"] },
  { nombre: "Pase Libre", porNombre: ["%pase libre%"] },

  // Las que la primera pasada dejó afuera: aparecieron en
  // `empresas_sin_mapear`, con un paciente cada una. No mueven la serie, pero
  // una empresa que el mapeo no ve es una empresa que desaparece del tablero.
  { nombre: "Qubika", porCodigo: ["#bienestarqubika%"] },
  { nombre: "Perficient", porCodigo: ["#perficient%"] },
  { nombre: "Innovant", porCodigo: ["#alianzainnovant%"] },
  { nombre: "On Point", porCodigo: ["#wellnessonpoint%"] },
  { nombre: "Advance", porCodigo: ["#bienestaradvance%"] },
  { nombre: "Universidad de los Andes", porCodigo: ["#alianzauandes%"] },
];

/** Lo que mira la pestaña: hay empresa detrás del cupón. */
export const SIN_EMPRESA = "";

/**
 * El `CASE` que traduce cupón a empresa, para pegarlo en una consulta a MySQL.
 *
 * Se arma acá y corre allá a propósito: así `cupones.nombre` se compara dentro
 * de MySQL y lo único que vuelve es el nombre de la empresa. El nombre del
 * cupón —que en varias familias es el de un paciente— no sale de la base.
 *
 * `alias` es el de la tabla `cupones` en la consulta.
 */
export function sqlEmpresa(alias = "c"): string {
  const ramas = EMPRESAS.map((e) => {
    const condiciones = [
      ...(e.porNombre ?? []).map(
        (p) => `LOWER(${alias}.nombre) LIKE ${comillas(p)}`,
      ),
      ...(e.porCodigo ?? []).map(
        (p) => `LOWER(${alias}.codigo) LIKE ${comillas(p)}`,
      ),
    ];
    return `WHEN ${condiciones.join(" OR ")} THEN ${comillas(e.nombre)}`;
  });
  return `CASE ${ramas.join("\n         ")} ELSE '' END`;
}

/**
 * Los patrones y los nombres son constantes de este archivo, no entrada de
 * nadie, pero la función arma SQL con ellos. L'Oréal tiene un apóstrofo, así
 * que se duplica como manda SQL en vez de confiar en que nunca aparezca.
 */
function comillas(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}
