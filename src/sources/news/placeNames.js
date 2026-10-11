/**
 * Country and city names as written in French, Spanish, German and
 * Portuguese, so headlines in those languages can be placed. Each maps to a
 * place already in the gazetteer; nothing here adds a coordinate.
 *
 * Only names that are unambiguous as a capitalised whole word are listed.
 * Left out on purpose: "Roma" (also a people and a football club) and
 * "Damas" (also "ladies" at the start of a Spanish headline).
 */

/** Rows: [name as written, ISO 3166-1 alpha-2]. */
// prettier-ignore
export const FOREIGN_COUNTRY_NAMES = [
  // French
  ['États-Unis', 'US'], ['Etats-Unis', 'US'], ['Royaume-Uni', 'GB'], ['Allemagne', 'DE'],
  ['Espagne', 'ES'], ['Italie', 'IT'], ['Russie', 'RU'], ['Chine', 'CN'], ['Japon', 'JP'],
  ['Inde', 'IN'], ['Brésil', 'BR'], ['Mexique', 'MX'], ['Turquie', 'TR'], ['Égypte', 'EG'],
  ['Israël', 'IL'], ['Liban', 'LB'], ['Syrie', 'SY'], ['Arabie saoudite', 'SA'],
  ['Afrique du Sud', 'ZA'], ['Maroc', 'MA'], ['Algérie', 'DZ'], ['Tunisie', 'TN'],
  ['Suisse', 'CH'], ['Belgique', 'BE'], ['Pays-Bas', 'NL'], ['Pologne', 'PL'], ['Grèce', 'GR'],
  ['Corée du Sud', 'KR'], ['Corée du Nord', 'KP'], ['Australie', 'AU'], ['Colombie', 'CO'],
  ['Soudan', 'SD'], ['Éthiopie', 'ET'], ['Yémen', 'YE'],
  // Spanish
  ['Estados Unidos', 'US'], ['EE UU', 'US'], ['EE.UU.', 'US'], ['Reino Unido', 'GB'],
  ['Alemania', 'DE'], ['Francia', 'FR'], ['España', 'ES'], ['Italia', 'IT'], ['Rusia', 'RU'],
  ['Japón', 'JP'], ['Brasil', 'BR'], ['México', 'MX'], ['Turquía', 'TR'], ['Egipto', 'EG'],
  ['Líbano', 'LB'], ['Siria', 'SY'], ['Arabia Saudí', 'SA'], ['Arabia Saudita', 'SA'],
  ['Sudáfrica', 'ZA'], ['Marruecos', 'MA'], ['Argelia', 'DZ'], ['Suiza', 'CH'],
  ['Bélgica', 'BE'], ['Países Bajos', 'NL'], ['Polonia', 'PL'], ['Grecia', 'GR'],
  ['Corea del Sur', 'KR'], ['Corea del Norte', 'KP'], ['Ucrania', 'UA'], ['Irán', 'IR'],
  ['Perú', 'PE'], ['Panamá', 'PA'], ['Canadá', 'CA'], ['Etiopía', 'ET'], ['Sudán', 'SD'],
  ['Kenia', 'KE'], ['Haití', 'HT'],
  // German
  ['Vereinigte Staaten', 'US'], ['Großbritannien', 'GB'], ['Deutschland', 'DE'],
  ['Frankreich', 'FR'], ['Spanien', 'ES'], ['Italien', 'IT'], ['Russland', 'RU'],
  ['Indien', 'IN'], ['Brasilien', 'BR'], ['Mexiko', 'MX'], ['Türkei', 'TR'], ['Ägypten', 'EG'],
  ['Libanon', 'LB'], ['Syrien', 'SY'], ['Saudi-Arabien', 'SA'], ['Südafrika', 'ZA'],
  ['Marokko', 'MA'], ['Algerien', 'DZ'], ['Schweiz', 'CH'], ['Belgien', 'BE'],
  ['Niederlande', 'NL'], ['Polen', 'PL'], ['Griechenland', 'GR'], ['Südkorea', 'KR'],
  ['Nordkorea', 'KP'], ['Australien', 'AU'], ['Argentinien', 'AR'], ['Kolumbien', 'CO'],
  ['Österreich', 'AT'], ['Ungarn', 'HU'], ['Schweden', 'SE'], ['Norwegen', 'NO'],
  ['Dänemark', 'DK'], ['Finnland', 'FI'], ['Tschechien', 'CZ'], ['Äthiopien', 'ET'],
  ['Jemen', 'YE'],
  // Portuguese
  ['EUA', 'US'], ['Alemanha', 'DE'], ['França', 'FR'], ['Espanha', 'ES'], ['Itália', 'IT'],
  ['Rússia', 'RU'], ['Japão', 'JP'], ['Índia', 'IN'], ['Turquia', 'TR'], ['Egito', 'EG'],
  ['Síria', 'SY'], ['Iraque', 'IQ'], ['Arábia Saudita', 'SA'], ['África do Sul', 'ZA'],
  ['Suíça', 'CH'], ['Holanda', 'NL'], ['Polônia', 'PL'], ['Grécia', 'GR'],
  ['Coreia do Sul', 'KR'], ['Coreia do Norte', 'KP'], ['Ucrânia', 'UA'], ['Irã', 'IR'],
  ['Colômbia', 'CO'], ['Etiópia', 'ET'], ['Sudão', 'SD'], ['Quênia', 'KE'], ['Iêmen', 'YE'],
];

/** Rows: [name as written, the city's name in the gazetteer]. */
// prettier-ignore
export const FOREIGN_CITY_NAMES = [
  ['Moscou', 'Moscow'], ['Moscú', 'Moscow'], ['Moskau', 'Moscow'],
  ['Londres', 'London'],
  ['Pékin', 'Beijing'], ['Pekín', 'Beijing'], ['Peking', 'Beijing'], ['Pequim', 'Beijing'],
  ['Bruxelles', 'Brussels'], ['Bruselas', 'Brussels'], ['Brüssel', 'Brussels'], ['Bruxelas', 'Brussels'],
  ['Varsovie', 'Warsaw'], ['Varsovia', 'Warsaw'], ['Warschau', 'Warsaw'],
  ['Athènes', 'Athens'], ['Atenas', 'Athens'], ['Athen', 'Athens'],
  ['Le Caire', 'Cairo'], ['El Cairo', 'Cairo'], ['Kairo', 'Cairo'],
  ['Téhéran', 'Tehran'], ['Teherán', 'Tehran'], ['Teheran', 'Tehran'], ['Teerã', 'Tehran'],
  ['Jérusalem', 'Jerusalem'], ['Jerusalén', 'Jerusalem'], ['Jerusalém', 'Jerusalem'],
  ['Kiew', 'Kyiv'],
  ['Nueva York', 'New York City'], ['Nova York', 'New York City'],
  ['Tokio', 'Tokyo'], ['Tóquio', 'Tokyo'],
  ['Wien', 'Vienna'], ['Vienne', 'Vienna'], ['Viena', 'Vienna'],
  ['Genf', 'Geneva'], ['Genève', 'Geneva'], ['Ginebra', 'Geneva'], ['Genebra', 'Geneva'],
  ['Riad', 'Riyadh'], ['Riade', 'Riyadh'], ['Riyad', 'Riyadh'],
  ['Beyrouth', 'Beirut'], ['Beirute', 'Beirut'],
  ['Bagdad', 'Baghdad'], ['Bagdá', 'Baghdad'],
  ['Lisbonne', 'Lisbon'], ['Lisboa', 'Lisbon'], ['Lissabon', 'Lisbon'],
  ['Damaskus', 'Damascus'], ['Damasco', 'Damascus'],
  ['La Haye', 'The Hague'], ['La Haya', 'The Hague'], ['Den Haag', 'The Hague'],
];
