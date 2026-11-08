/**
 * De `departamentos.nombreDep` a una provincia que se pueda dibujar.
 *
 * La base tiene cuatro tablas de geografía que el proyecto nunca había
 * abierto: `departamentos` (75 filas, provincias de Argentina, departamentos
 * de Uruguay y regiones de Chile), `zonas` (273, barrios y ciudades adentro de
 * cada una), y las dos de enlace, `zonas_pacientes` y `zonas_terapeutas`.
 *
 * Lo que un paciente carga es una **lista de preferencias** —"puedo ir a estos
 * barrios"— y no un domicilio: el 57% de los presenciales argentinos tiene más
 * de una zona. Pero medido el 2026-11-08 sobre seis meses, las zonas de más
 * siempre caen en el MISMO departamento: 183 pares paciente-departamento sobre
 * 183 pacientes con zona, exacto, en los dos países. Por eso el corte es por
 * departamento y no por zona, y por eso cada persona se cuenta una sola vez.
 *
 * El catálogo está escrito a mano y hay que limpiarlo. CABA aparece tres veces
 * con tres nombres, Buenos Aires cuatro, Santa Fe dos —una con el typo
 * "Sante Fe"—, y mezcla niveles: `Rosario`, `La Plata`, `Mar del Plata` y
 * `Resistencia` son ciudades que figuran como si fueran provincias. Varios
 * nombres terminan con un espacio.
 *
 * Chile no aparece acá: queda afuera de todo el tablero (METRICAS.md §1).
 */

type Provincia = {
  /** Cómo se llama en pantalla. */
  nombre: string;
  /** Qué países la tienen. 'Río Negro' existe en los dos. */
  pais: "AR" | "UY";
  /**
   * Los `nombreDep` crudos que caen acá, en minúscula y sin espacios al
   * borde. Comparación exacta y no `LIKE`: la lista es de 75 filas y se puede
   * mirar entera, así que un patrón suelto solo serviría para tragarse en
   * silencio algo que todavía no vimos.
   */
  crudos: string[];
};

/**
 * Lo que se unió y lo que no, que es la parte opinable:
 *
 *  · **GBA entra en Buenos Aires.** El Gran Buenos Aires es parte de la
 *    provincia, y separarlo dejaría dos líneas de tres pacientes cada una.
 *    Si para Business son dos mercados distintos, se separa en una línea.
 *  · **Rosario entra en Santa Fe**, y La Plata, Bahía Blanca y Mar del Plata
 *    en Buenos Aires: son ciudades, no provincias. Mismo criterio para
 *    Resistencia, que va a Chaco.
 *  · **Ciudad de la Costa entra en Canelones**, por lo mismo.
 */
const PROVINCIAS: Provincia[] = [
  // Argentina.
  {
    nombre: "CABA",
    pais: "AR",
    crudos: ["capital federal (caba)", "caba", "ciudad de buenos aires"],
  },
  {
    nombre: "Buenos Aires",
    pais: "AR",
    crudos: [
      "provincia de buenos aires",
      "buenos aires",
      "bs as",
      "gran buenos aires (gba)",
      "la plata",
      "bahía blanca",
      "bahia blanca",
      "mar del plata",
    ],
  },
  { nombre: "Córdoba", pais: "AR", crudos: ["córdoba", "còrdoba capital", "cordoba"] },
  { nombre: "Santa Fe", pais: "AR", crudos: ["santa fe", "sante fe", "rosario"] },
  { nombre: "Mendoza", pais: "AR", crudos: ["mendoza"] },
  { nombre: "Tucumán", pais: "AR", crudos: ["tucumán", "tucuman"] },
  { nombre: "Entre Ríos", pais: "AR", crudos: ["entre ríos", "entre rios"] },
  { nombre: "Chaco", pais: "AR", crudos: ["chaco", "resistencia"] },
  { nombre: "Salta", pais: "AR", crudos: ["salta"] },
  { nombre: "Chubut", pais: "AR", crudos: ["chubut"] },
  { nombre: "Río Negro", pais: "AR", crudos: ["rio negro", "río negro"] },
  { nombre: "Corrientes", pais: "AR", crudos: ["corrientes"] },
  { nombre: "La Rioja", pais: "AR", crudos: ["la rioja"] },
  { nombre: "Neuquén", pais: "AR", crudos: ["neuquén", "neuquen"] },
  { nombre: "San Juan", pais: "AR", crudos: ["san juan"] },
  { nombre: "San Luis", pais: "AR", crudos: ["san luis"] },
  { nombre: "Formosa", pais: "AR", crudos: ["formosa"] },
  { nombre: "Jujuy", pais: "AR", crudos: ["jujuy"] },
  { nombre: "Misiones", pais: "AR", crudos: ["misiones"] },
  { nombre: "Santiago del Estero", pais: "AR", crudos: ["santiago del estero"] },

  // Uruguay.
  { nombre: "Montevideo", pais: "UY", crudos: ["montevideo"] },
  { nombre: "Canelones", pais: "UY", crudos: ["canelones", "ciudad de la costa"] },
  { nombre: "Maldonado", pais: "UY", crudos: ["maldonado"] },
  { nombre: "Colonia", pais: "UY", crudos: ["colonia"] },
  { nombre: "Salto", pais: "UY", crudos: ["salto"] },
  { nombre: "Paysandú", pais: "UY", crudos: ["paysandu", "paysandú"] },
  { nombre: "Rivera", pais: "UY", crudos: ["rivera"] },
  { nombre: "Rocha", pais: "UY", crudos: ["rocha"] },
  { nombre: "Tacuarembó", pais: "UY", crudos: ["tacuarembó", "tacuarembo"] },
  { nombre: "Florida", pais: "UY", crudos: ["florida"] },
  { nombre: "Cerro Largo", pais: "UY", crudos: ["cerro largo"] },
  { nombre: "Durazno", pais: "UY", crudos: ["durazno"] },
  { nombre: "Flores", pais: "UY", crudos: ["flores"] },
  { nombre: "Lavalleja", pais: "UY", crudos: ["lavalleja"] },
  { nombre: "Río Negro", pais: "UY", crudos: ["rio negro", "río negro"] },
  { nombre: "San José", pais: "UY", crudos: ["san josé", "san jose"] },
  { nombre: "Soriano", pais: "UY", crudos: ["soriano"] },
];

/** Lo que el paciente no cargó, y la basura que da lo mismo. */
export const SIN_ZONA = "sin zona";

/** Basura explícita. Un gráfico con una provincia llamada "x" se ve roto. */
const BASURA = ["x", "n/a", "na", "-", "", "santiago"];

/**
 * El `CASE` que traduce `nombreDep` a provincia, para pegar en una consulta.
 *
 * Corre adentro de MySQL para que el `COUNT(DISTINCT paciente)` se haga
 * DESPUÉS de unir los nombres: si "CABA" y "CAPITAL FEDERAL (CABA)" se
 * contaran por separado y se sumaran después, un paciente que tuviera zonas
 * con los dos nombres aparecería dos veces y la suma dejaría de dar
 * `pacientes_nuevos`.
 *
 * Lo que no cae en ninguna rama vuelve con su nombre crudo, sin espacios al
 * borde. Se podría mandar a un cajón "otras", pero entonces una provincia
 * nueva se escondería sola y nadie se enteraría; así aparece con el nombre
 * feo que tiene en la base y se ve que falta mapearla.
 *
 * `dep` es el alias de la tabla `departamentos`, `zp` el de `zonas_pacientes`
 * —de ahí sale el país, porque 'Río Negro' existe en los dos—.
 */
export function sqlProvincia(dep = "d", zp = "zp"): string {
  const crudo = `TRIM(LOWER(${dep}.nombreDep))`;
  const ramas = PROVINCIAS.map(
    (p) =>
      `WHEN ${zp}.isoPais = '${p.pais}' AND ${crudo} IN (${p.crudos
        .map(comillas)
        .join(", ")}) THEN ${comillas(p.nombre)}`,
  );
  return [
    `CASE WHEN ${dep}.nombreDep IS NULL THEN ${comillas(SIN_ZONA)}`,
    `     WHEN ${crudo} IN (${BASURA.map(comillas).join(", ")}) THEN ${comillas(SIN_ZONA)}`,
    ...ramas.map((r) => `     ${r}`),
    `     ELSE TRIM(${dep}.nombreDep) END`,
  ].join("\n");
}

/**
 * Los nombres son constantes de este archivo, no entrada de nadie, pero la
 * función arma SQL con ellos. Igual se escapa la comilla simple: es una
 * línea y evita que el día que alguien agregue un nombre con apóstrofo la
 * consulta se rompa de una manera rara.
 */
function comillas(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}
