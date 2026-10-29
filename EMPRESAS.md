# Empresas · mapeo de cupones

Borrador para revisar con el dueño del producto. Todavía **no** es una tabla ni
una migración: es la lista de lo que los cupones dicen que son, para que
alguien que sabe la confirme.

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
| VESTA | `VestaGXC`, `VestaNDM`, `VestaDL`, `VestaUW`, `VestaHUB`, `VestaGS`, `VestaGLA` | 8 | ~98 | UY |
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

Son **56 empresas** y alrededor de **1.600 usos**, no los 5.690 que contaba la
regla anterior.

## Los `#` que NO son empresa

| Cupón | Qué es | Pacientes |
|---|---|---|
| `#fcyo:)` | Cumpleaños — ya estaba en la lista de promocionales | 822 |
| `#promocomunidad` | campaña "Pos-suba" de 2023 | 126 |
| `#Miprimerasesión`, `#Primerasesion` | campaña de primera sesión | 69 |
| `#BeneficioTuTerapia`, `#BienestarTuTerapia` | campaña propia | 64 |
| `#paselibre` | producto "Pase Libre (On Demand)" | 4 |
| `#TallerPosadas` | evento de concientización | 2 |
| `#uruguayosenusa2023` | acuerdo con una comunidad, no una empresa | 1 |
| `#practicante` | práctica profesional | 1 |
| `#Prueba9933` | prueba interna | 1 |
| dos cupones nominales sueltos | descuento a una persona | 2 |

---

## Lo que falta decidir

1. **VESTA**: ¿es un cliente o un intermediario? Los siete cupones nombran
   empresas distintas (GXC, Nodum, Datalogic, Uruware, VSGLATAM, Gsoft,
   Greycon). Si es un canal, la pestaña debería mostrar las siete por separado
   y no "VESTA".
2. **Los cupones por persona** (Fosmetal, Farmashop, ISA, Movigroup,
   Securitas): ¿cuentan dentro de su empresa? Doy por sí, pero decilo vos.
3. **Kinko, Big Cheese, AXO, Arcsona, Applevel** tienen un cupón "particular"
   además del de la empresa. ¿Es la misma empresa o es alguien que siguió por
   su cuenta después de que la empresa dejó de pagar? Cambia qué significa
   dar de baja a una empresa.
4. **`#paselibre` y `#practicante`**: ¿son producto o empresa?
5. **Las campañas** que la regla vieja mandaba a business (Black Friday, cyber,
   cumpleaños, los mensuales de ads) — ¿van a una tercera categoría
   "promocional" o quedan afuera de la pestaña?

## Cómo se mantiene

Las empresas nuevas aparecen solas: alguien crea `#bienestarXXX` y nadie avisa.
Propuesta: una tabla `marketing.cupon_empresa` (id de cupón → empresa), igual
que `marketing.utm_mapping`, y un aviso en la pestaña con los cupones que
empiezan con `#` y todavía no tienen empresa asignada. Así un cupón nuevo se ve
como "sin mapear" en vez de desaparecer de los números.
