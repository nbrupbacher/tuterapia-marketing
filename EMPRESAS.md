# Empresas · mapeo de cupones

La lista de lo que los cupones dicen que son, **confirmada por el dueño del
producto el 2026-10-29**. Vive en código en `lib/empresas.ts`, que es lo que
la pestaña usa; este documento es el porqué.

Fecha de la lectura: **2026-10-29**, sobre los 831 cupones que alguna vez se
usaron.

---

## Por qué existe este documento

La primera regla que probamos —«business es todo cupón que no sea uno de los
promocionales»— se cayó al leer los nombres. Del lado business caían
`BLACKFRIDAY23`, `cumpleaños`, `cyberlunes`, `carnaval`, `hotsale25` y tres
cupones llamados literalmente **"fb ads"**. Eso son campañas de descuento, no
empresas, y eran la mayor parte de los 803 cupones y de los 5.690 pacientes que
había contado.

Las empresas, en cambio, **se nombran solas**. El código arranca con `#` y el
campo `nombre` dice la empresa en castellano. Vesta es la única familia que no
lleva `#`.

Pero `#` no alcanza como regla: `#promocomunidad`, `#Miprimerasesión` y
`#BeneficioTuTerapia` también empiezan con `#` y son campañas. Por eso esto es
una lista revisada a mano y no un `WHERE`.

## Dato personal — leer antes de tocar nada

Varias empresas emiten **un cupón por persona**, y el nombre del cupón trae el
nombre de esa persona. Son pacientes en tratamiento.

Por la regla de `CLAUDE.md`, ese nombre:

- no se guarda en ninguna tabla de Supabase;
- no lo lee ninguna consulta del job;
- no se escribe en este repositorio.

El mapeo guarda **la empresa y nada más**. Las familias por persona se cuentan,
no se listan.

---

## Las empresas

Los pacientes son la suma de los pacientes distintos de cada cupón de la
familia, así que alguien que usó dos cupones de la misma empresa está contado
dos veces. Sirve para ordenar, no para publicar.

| Empresa | Familias de cupón | Cupones | Pacientes (aprox.) | País |
|---|---|---|---|---|
| Farmashop | `#bienestarfarma25` + familia "Líderes Farmashop" (uno por persona) | ~26 | ~350 | UY |
| TCS | `#BienestarTCS`, `#continuarTT` | 2 | 252 | UY |
| GXC Consulting (Vesta) | `VestaGXC` | 1 | 32 | UY |
| Nodum (Vesta) | `VestaNDM` | 2 | 30 | UY |
| Datalogic (Vesta) | `VestaDL` | 1 | 10 | UY |
| Uruware (Vesta) | `VestaUW` | 1 | 9 | UY |
| VSGLATAM (Vesta) | `VestaHUB` | 1 | 9 | UY |
| Gsoft (Vesta) | `VestaGS` | 1 | 4 | UY |
| Greycon (Vesta) | `VestaGLA` | 1 | 4 | UY |
| UTEC | `#alianzautec0723` | 1 | 93 | UY |
| Fosmetal | `#FOSMETAL25` + familia por persona | ~60 | ~89 | UY |
| December Labs | `#wellnessDL` | 2 | 67 | UY + AR |
| Galicia | `#galicia24`, `#galicia2025` | 2 | 66 | AR |
| L'Oréal | `#lorealpotenciar`, `#alianzaloreal23-1` | 2 | 53 | UY |
| AXO | `#bienestarAXO`, `#particularAXO` | 2 | 53 | UY |
| Kinko | `#primerakinko`, `#bienestarkinko` | 2 | 47 | UY |
| USAL | `#alianzausal23` | 1 | 39 | AR |
| Arcsona | `#wellnessarcsona`, `#arcsonaparticular`, `#Arcparticular`, `#ArcsonaMDB` | 4 | 31 | UY |
| Globant | `#alianzaglobant23`, `#bienestarglobant25`, `#wellnessG` | 3 | 31 | UY + CL |
| Pilay | `#BienestarPilay` | 1 | 25 | AR |
| Big Cheese | `#bienestarBC`, `#bigcheeseparticular` | 4 | 22 | UY + AR |
| TaTa | `#tata24` | 1 | 21 | UY |
| Kaizen | `#bienestarkaizen` | 1 | 20 | UY |
| SiSi | `#bienestarSISI` | 1 | 20 | UY |
| ANII | `#bienestarANII` | 1 | 19 | UY |
| ANCAP | `#alianzaANCAP` | 1 | 17 | UY |
| Quanam | `#bienestarQ`, `#BienestarQDE` | 2 | 14 | UY |
| UTE | `#alianzaUTE` | 1 | 13 | UY |
| Orangeloops | `#BienestarOL`, `#Orangeloops5710` | 2 | 13 | UY |
| Fraylog | `#Fraylog.24` | 1 | 12 | UY |
| Catengril Country Club | `#BienestarCCC`, `#CCC7975`, `#CCCPrimera` | 3 | 10 | UY |
| Afap Itaú | `#BienestarAfapi` | 1 | 10 | UY |
| Vairix | `#primeraVX`, `#wellnessVX` | 2 | 9 | UY |
| Manpower | `#manpower24` | 1 | 7 | UY |
| WILD FI | `#bienestarWILDFI` | 1 | 6 | UY |
| Chic Parisien | `#chic24` | 1 | 6 | UY |
| Securitas | `#alianzaSecuritas` + 2 por persona | 3 | 6 | UY |
| ISA | familia por persona | 5 | 5 | UY |
| BESTSELLER | `#alianzaBESTSELLER` | 1 | 5 | UY |
| Rootstrap | `#BienestarROOTSTRAP` | 1 | 5 | UY |
| Applevel | `#PrimeraAL`, `#BeneficioAL` | 2 | 5 | UY |
| Movigroup | familia por persona | 3 | 4 | UY |
| Coderhouse | `#coder24` | 1 | 4 | AR |
| Flix | `#flixpotenciar` | 1 | 4 | AR |
| Microlab | `#BienestarMicrolab` | 1 | 4 | UY |
| Sofka | `#BienestarSOFKA` | 1 | 3 | UY |
| Darnel | `#bienestardarnel` | 1 | 3 | UY |
| Bosch y Cía | `#BienestarBosch` | 1 | 3 | UY |
| Aldeas Infantiles | `#alianzaAI` | 1 | 3 | UY |
| Gómez Platero | `#AlianzaGP` | 1 | 2 | UY |
| ANDA | `#anda473` | 1 | 2 | UY |
| FOCUS | `#BienestarFOCUS` | 1 | 2 | UY |
| Pedidos Ya | `#alianzaPEYA` | 1 | 2 | UY |
| Maslow | `#bienestarmaslow` | 1 | 2 | AR |
| HCA | `#bienestarhca` | 1 | 2 | UY |
| INTERFASE | familia por persona | 1 | 2 | UY |
| Cedarcode | `#bienestarcedarcode` | 1 | 2 | UY |
| Nearsure | `#bienestarNS` | 1 | 2 | UY |
| Audaca | `#bienestaraudaca` | 1 | 2 | UY |
| Bonprole | `#bonprole` | 1 | 1 | UY |
| HSBC | `#bienestarhsbc` | 1 | 1 | UY |
| Pase Libre | `#paselibre` | 1 | 4 | UY |

Son **61 empresas** y alrededor de **1.600 usos**, no los 5.690 que contaba la
regla anterior.

Vesta no es un cliente: es el grupo que tiene a las otras siete. Van con su
propio nombre y Vesta al costado.

## Los `#` que NO son empresa

| Cupón | Qué es | Pacientes |
|---|---|---|
| `#fcyo:)` | Cumpleaños — ya estaba en la lista de promocionales | 822 |
| `#promocomunidad` | campaña "Pos-suba" de 2023 | 126 |
| `#Miprimerasesión`, `#Primerasesion` | campaña de primera sesión | 69 |
| `#BeneficioTuTerapia`, `#BienestarTuTerapia` | campaña propia | 64 |
| `#TallerPosadas` | evento de concientización | 2 |
| `#uruguayosenusa2023` | acuerdo con una comunidad, no una empresa | 1 |
| `#practicante` | práctica profesional | 1 |
| `#Prueba9933` | prueba interna | 1 |
| dos cupones nominales sueltos | descuento a una persona | 2 |

---

## Lo que se decidió el 2026-10-29

1. **Vesta es el grupo**, no el cliente: las siete van por su propio nombre,
   con Vesta aclarado al costado.
2. **Los cupones por persona** (Fosmetal, Farmashop, ISA, Movigroup,
   Securitas) suman a su empresa.
3. **Los cupones "particular"** (Kinko, Big Cheese, AXO, Arcsona, Applevel,
   Orangeloops, Nodum) son la misma empresa.
4. **`#paselibre` es empresa**; **`#practicante` no**.
5. **Las campañas no son empresa**: Black Friday, cyber, cumpleaños, carnaval,
   los cupones mensuales de ads y los de primera sesión quedan afuera de la
   pestaña.

## Lo que sigue abierto

Nada del mapeo. Lo que falta es de la pestaña, no de las empresas: **qué es un
paciente activo de empresa**. "Alguna vez usó un cupón de empresa" y "compró
con un cupón de empresa en el mes" son dos preguntas distintas y dan números
que difieren al doble.

## Cómo se mantiene

Las empresas nuevas aparecen solas: alguien crea `#bienestarXXX` y nadie avisa.

El mapeo vive en **`lib/empresas.ts`**, como una lista ordenada de patrones
—gana el primero que matchea— que se traduce a un `CASE` y se manda a MySQL.
Que la traducción pase **adentro** de MySQL es a propósito: así `cupones.nombre`
se compara allá y lo único que vuelve es el nombre de la empresa. El nombre del
cupón, que en varias familias es el de un paciente, no sale de la base.

El orden resuelve dos choques reales: Fosmetal va antes que ISA, porque un
apellido con "isa" adentro caía en ISA; y Fraylog antes que Pase Libre, porque
su cupón se llama "Fraylog (Pase Libre)".

Para que un cupón nuevo no desaparezca de los números, la sonda
`empresas_sin_mapear` lista los que empiezan con `#` y no cayeron en ninguna
empresa. Hoy ahí tienen que quedar solo las campañas y `#practicante`.
