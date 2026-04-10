import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/admin/seed-rosters
// Body: { league_id: string }
// One-time endpoint to populate all team rosters from predefined data.
// Uses admin client — bypasses RLS.

const ROSTER_DATA = [
  {
    team: 'Corleone Giocatori',
    players: [
      { name: 'Agustín Ramírez',   slot: 'C' },
      { name: 'Freddie Freeman',    slot: '1B' },
      { name: 'Brandon Lowe',       slot: '2B' },
      { name: 'Nolan Arenado',      slot: '3B' },
      { name: 'Zach Neto',          slot: 'SS' },
      { name: 'Gleyber Torres',     slot: 'IF' },
      { name: 'Jac Caglianone',     slot: 'OF' },
      { name: 'Riley Greene',       slot: 'OF' },
      { name: 'Bryan Reynolds',     slot: 'OF' },
      { name: 'Carson Benge',       slot: 'OF' },
      { name: 'George Springer',    slot: 'UTIL' },
      { name: 'Mike Trout',         slot: 'UTIL' },
      { name: 'James Wood',         slot: 'UTIL' },
      { name: 'Seth Lugo',          slot: 'SP' },
      { name: 'Eury Pérez',         slot: 'SP' },
      { name: 'Luis Severino',      slot: 'SP' },
      { name: 'Aroldis Chapman',    slot: 'RP' },
      { name: 'Jacob deGrom',       slot: 'P' },
      { name: 'Trevor Story',       slot: 'BENCH' },
      { name: 'Konnor Griffin',     slot: 'BENCH' },
      { name: 'Paul Skenes',        slot: 'BENCH' },
      { name: 'Garrett Crochet',    slot: 'BENCH' },
      { name: 'Brandon Woodruff',   slot: 'BENCH' },
      { name: 'Andrew Painter',     slot: 'BENCH' },
      { name: 'Kyle Harrison',      slot: 'BENCH' },
      { name: 'Jackson Holliday',   slot: 'IL' },
      { name: 'Merrill Kelly',      slot: 'IL' },
      { name: 'Zack Wheeler',       slot: 'IL' },
      { name: 'Blake Snell',        slot: 'IL' },
      { name: 'Hunter Greene',      slot: 'IL' },
      { name: 'José Berríos',       slot: 'IL' },
      { name: 'Zach Eflin',         slot: 'IL' },
      { name: 'Emmanuel Rodriguez', slot: 'NA' },
      { name: 'Leo De Vries',       slot: 'NA' },
      { name: 'Max Clark',          slot: 'NA' },
      { name: 'Luis Peña',          slot: 'NA' },
      { name: 'Luis Gil',           slot: 'NA' },
    ],
  },
  {
    team: "Dee's Dreams",
    players: [
      { name: 'Cal Raleigh',        slot: 'C' },
      { name: 'Bryce Harper',       slot: '1B' },
      { name: 'Ketel Marte',        slot: '2B' },
      { name: 'Royce Lewis',        slot: '3B' },
      { name: 'Corey Seager',       slot: 'SS' },
      { name: 'Xander Bogaerts',    slot: 'IF' },
      { name: 'Roman Anthony',      slot: 'OF' },
      { name: 'Oneil Cruz',         slot: 'OF' },
      { name: 'Luis Robert Jr.',    slot: 'OF' },
      { name: 'Seiya Suzuki',       slot: 'OF' },
      { name: 'Shohei Ohtani',      slot: 'UTIL' },
      { name: 'Jonathan Aranda',    slot: 'UTIL' },
      { name: 'Byron Buxton',       slot: 'UTIL' },
      { name: 'Ryan Weathers',      slot: 'SP' },
      { name: 'Nolan McLean',       slot: 'SP' },
      { name: 'Randy Vásquez',      slot: 'SP' },
      { name: 'Chase Burns',        slot: 'RP' },
      { name: 'Cam Schlittler',     slot: 'P' },
      { name: 'Corbin Carroll',     slot: 'BENCH' },
      { name: 'Julio Rodríguez',    slot: 'BENCH' },
      { name: 'Freddy Peralta',     slot: 'BENCH' },
      { name: 'Michael King',       slot: 'BENCH' },
      { name: 'Robbie Ray',         slot: 'BENCH' },
      { name: 'Cristopher Sánchez', slot: 'BENCH' },
      { name: 'Luis Castillo',      slot: 'BENCH' },
      { name: 'Ryan Pepiot',        slot: 'IL' },
      { name: 'Jackson Jobe',       slot: 'IL' },
      { name: 'Colt Emerson',       slot: 'NA' },
      { name: 'Franklin Arias',     slot: 'NA' },
      { name: 'Josuar Gonzalez',    slot: 'NA' },
      { name: 'James Tibbs III',    slot: 'NA' },
      { name: 'Ryan Sloan',         slot: 'NA' },
      { name: 'Liam Doyle',         slot: 'NA' },
    ],
  },
  {
    team: 'Hospital on Guerrero',
    players: [
      { name: 'Carter Jensen',          slot: 'C' },
      { name: 'Vladimir Guerrero Jr.',  slot: '1B' },
      { name: 'Jazz Chisholm Jr.',      slot: '2B' },
      { name: 'José Ramírez',           slot: '3B' },
      { name: 'Kevin McGonigle',        slot: 'SS' },
      { name: 'Vinnie Pasquantino',     slot: 'IF' },
      { name: 'Kyle Tucker',            slot: 'OF' },
      { name: 'Cody Bellinger',         slot: 'OF' },
      { name: 'Mickey Moniak',          slot: 'OF' },
      { name: 'Andy Pages',             slot: 'OF' },
      { name: 'Elly De La Cruz',        slot: 'UTIL' },
      { name: 'Liam Hicks',             slot: 'UTIL' },
      { name: 'Jeremy Peña',            slot: 'UTIL' },
      { name: 'Zac Gallen',             slot: 'SP' },
      { name: 'Jonah Tong',             slot: 'SP' },
      { name: 'Emerson Hancock',        slot: 'SP' },
      { name: 'David Bednar',           slot: 'RP' },
      { name: 'Jaxon Wiggins',          slot: 'P' },
      { name: 'Daylen Lile',            slot: 'BENCH' },
      { name: 'MacKenzie Gore',         slot: 'BENCH' },
      { name: 'Joey Cantillo',          slot: 'BENCH' },
      { name: 'Kyle Bradish',           slot: 'BENCH' },
      { name: 'Andre Pallante',         slot: 'BENCH' },
      { name: 'Javier Assad',           slot: 'BENCH' },
      { name: 'Jack Leiter',            slot: 'BENCH' },
      { name: 'Max Scherzer',           slot: 'BENCH' },
      { name: 'Spencer Schwellenbach',  slot: 'IL' },
      { name: 'Gerrit Cole',            slot: 'IL' },
      { name: 'AJ Smith-Shawver',       slot: 'IL' },
      { name: 'Hunter Brown',           slot: 'IL' },
      { name: 'Jasson Domínguez',       slot: 'NA' },
      { name: 'Jesús Made',             slot: 'NA' },
      { name: 'Charlie Condon',         slot: 'NA' },
      { name: 'Ethan Salas',            slot: 'NA' },
      { name: 'Seth Hernandez',         slot: 'NA' },
      { name: 'Thomas White',           slot: 'NA' },
    ],
  },
  {
    team: "Jeff Seager's Sperm",
    players: [
      { name: 'Will Smith',             slot: 'C' },
      { name: 'Rafael Devers',          slot: '1B' },
      { name: 'Jose Altuve',            slot: '2B' },
      { name: 'Alex Bregman',           slot: '3B' },
      { name: 'Trea Turner',            slot: 'SS' },
      { name: 'Francisco Lindor',       slot: 'IF' },
      { name: 'Aaron Judge',            slot: 'OF' },
      { name: 'Kyle Schwarber',         slot: 'OF' },
      { name: 'Lawrence Butler',        slot: 'OF' },
      { name: 'Kerry Carpenter',        slot: 'OF' },
      { name: 'Max Muncy',              slot: 'UTIL' },
      { name: 'Yandy Díaz',             slot: 'UTIL' },
      { name: 'Christian Walker',       slot: 'UTIL' },
      { name: 'Reynaldo López',         slot: 'SP' },
      { name: 'Clay Holmes',            slot: 'SP' },
      { name: 'Davis Martin',           slot: 'SP' },
      { name: 'Jeff Hoffman',           slot: 'RP' },
      { name: 'Raisel Iglesias',        slot: 'P' },
      { name: 'Trent Grisham',          slot: 'BENCH' },
      { name: 'Geraldo Perdomo',        slot: 'BENCH' },
      { name: 'Grant Holmes',           slot: 'BENCH' },
      { name: 'Tarik Skubal',           slot: 'BENCH' },
      { name: 'Jacob Misiorowski',      slot: 'BENCH' },
      { name: 'Logan Webb',             slot: 'BENCH' },
      { name: 'Brayan Bello',           slot: 'BENCH' },
      { name: 'Max Meyer',              slot: 'BENCH' },
      { name: 'Quinn Priester',         slot: 'IL' },
      { name: 'Trey Yesavage',          slot: 'IL' },
      { name: 'Nick Lodolo',            slot: 'IL' },
      { name: 'Felnin Celesten',        slot: 'NA' },
      { name: 'Payton Tolle',           slot: 'NA' },
      { name: 'Travis Sykora',          slot: 'NA' },
      { name: 'Gage Jump',              slot: 'NA' },
      { name: 'Jurrangelo Cijntje',     slot: 'NA' },
      { name: 'Cam Caminiti',           slot: 'NA' },
    ],
  },
  {
    team: 'Men of Faith',
    players: [
      { name: 'William Contreras',      slot: 'C' },
      { name: 'Willson Contreras',      slot: '1B' },
      { name: 'Mauricio Dubón',         slot: '2B' },
      { name: 'Manny Machado',          slot: '3B' },
      { name: 'Ernie Clement',          slot: 'SS' },
      { name: 'Marcus Semien',          slot: 'IF' },
      { name: 'Randy Arozarena',        slot: 'OF' },
      { name: 'Christian Yelich',       slot: 'OF' },
      { name: 'Brandon Nimmo',          slot: 'OF' },
      { name: 'Giancarlo Stanton',      slot: 'OF' },
      { name: 'Brice Turang',           slot: 'UTIL' },
      { name: 'Teoscar Hernández',      slot: 'UTIL' },
      { name: 'Ian Happ',               slot: 'UTIL' },
      { name: 'Mitch Keller',           slot: 'SP' },
      { name: 'Michael Wacha',          slot: 'SP' },
      { name: 'Tyler Glasnow',          slot: 'SP' },
      { name: 'Devin Williams',         slot: 'RP' },
      { name: 'Gavin Williams',         slot: 'P' },
      { name: 'Marcelo Mayer',          slot: 'BENCH' },
      { name: 'Andrew Abbott',          slot: 'BENCH' },
      { name: 'Yusei Kikuchi',          slot: 'BENCH' },
      { name: 'Nathan Eovaldi',         slot: 'BENCH' },
      { name: 'Logan Gilbert',          slot: 'BENCH' },
      { name: 'Jameson Taillon',        slot: 'BENCH' },
      { name: 'Eric Lauer',             slot: 'BENCH' },
      { name: 'Max Fried',              slot: 'BENCH' },
      { name: 'Jackson Chourio',        slot: 'IL' },
      { name: 'Cody Ponce',             slot: 'IL' },
      { name: 'Kristian Campbell',      slot: 'NA' },
      { name: 'Eli Willits',            slot: 'NA' },
      { name: 'Yorger Bautista',        slot: 'NA' },
      { name: 'Jamie Arnold',           slot: 'NA' },
      { name: 'Carlos Lagrange',        slot: 'NA' },
    ],
  },
  {
    team: "Mr. T-Ballers",
    players: [
      { name: 'Adley Rutschman',        slot: 'C' },
      { name: 'Munetaka Murakami',      slot: '1B' },
      { name: 'Ozzie Albies',           slot: '2B' },
      { name: 'JJ Wetherholt',          slot: '3B' },
      { name: 'Gunnar Henderson',       slot: 'SS' },
      { name: 'Josh Naylor',            slot: 'IF' },
      { name: 'Ronald Acuña Jr.',       slot: 'OF' },
      { name: 'Michael Harris II',      slot: 'OF' },
      { name: 'Fernando Tatis Jr.',     slot: 'OF' },
      { name: 'Chase DeLauter',         slot: 'OF' },
      { name: 'Austin Riley',           slot: 'UTIL' },
      { name: 'Luke Keaschall',         slot: 'UTIL' },
      { name: 'Owen Caissie',           slot: 'UTIL' },
      { name: 'Eduardo Rodriguez',      slot: 'SP' },
      { name: 'Kris Bubic',             slot: 'SP' },
      { name: 'Chad Patrick',           slot: 'SP' },
      { name: 'Noah Cameron',           slot: 'P' },
      { name: 'Samuel Basallo',         slot: 'BENCH' },
      { name: 'Aaron Nola',             slot: 'BENCH' },
      { name: 'Dylan Cease',            slot: 'BENCH' },
      { name: 'Matthew Liberatore',     slot: 'BENCH' },
      { name: 'Nick Pivetta',           slot: 'BENCH' },
      { name: 'Chris Sale',             slot: 'BENCH' },
      { name: 'Casey Mize',             slot: 'BENCH' },
      { name: 'Parker Messick',         slot: 'BENCH' },
      { name: 'Ranger Suarez',          slot: 'BENCH' },
      { name: 'Shane Bieber',           slot: 'IL' },
      { name: 'Spencer Strider',        slot: 'IL' },
      { name: 'Justin Steele',          slot: 'IL' },
      { name: 'Ethan Holliday',         slot: 'NA' },
      { name: 'Joshua Baez',            slot: 'NA' },
      { name: 'Bryce Rainer',           slot: 'NA' },
      { name: 'Didier Fuentes',         slot: 'NA' },
      { name: 'Tyler Bremner',          slot: 'NA' },
      { name: 'Elmer Rodríguez',        slot: 'NA' },
    ],
  },
  {
    team: "OG's Farm Team",
    players: [
      { name: 'Shea Langeliers',        slot: 'C' },
      { name: 'Nick Kurtz',             slot: '1B' },
      { name: 'Matt McLain',            slot: '2B' },
      { name: 'Junior Caminero',        slot: '3B' },
      { name: 'Bo Bichette',            slot: 'SS' },
      { name: 'Sal Stewart',            slot: 'IF' },
      { name: 'Yordan Alvarez',         slot: 'OF' },
      { name: 'Jakob Marsee',           slot: 'OF' },
      { name: 'Tyler Soderstrom',       slot: 'OF' },
      { name: 'Maikel Garcia',          slot: 'OF' },
      { name: 'Jordan Walker',          slot: 'UTIL' },
      { name: 'Brady House',            slot: 'UTIL' },
      { name: 'Steven Kwan',            slot: 'UTIL' },
      { name: 'Michael Soroka',         slot: 'SP' },
      { name: 'Connelly Early',         slot: 'SP' },
      { name: 'Tatsuya Imai',           slot: 'SP' },
      { name: 'Cade Smith',             slot: 'RP' },
      { name: 'Ryan Helsley',           slot: 'P' },
      { name: 'Ben Rice',               slot: 'BENCH' },
      { name: 'Sandy Alcantara',        slot: 'BENCH' },
      { name: 'Jack Flaherty',          slot: 'BENCH' },
      { name: 'Kodai Senga',            slot: 'BENCH' },
      { name: 'Joe Ryan',               slot: 'BENCH' },
      { name: 'Trevor Rogers',          slot: 'BENCH' },
      { name: 'Tanner Bibee',           slot: 'BENCH' },
      { name: 'Shane McClanahan',       slot: 'BENCH' },
      { name: 'Mookie Betts',           slot: 'IL' },
      { name: 'Kyle Stowers',           slot: 'IL' },
      { name: 'Jordan Westburg',        slot: 'IL' },
      { name: 'Pablo López',            slot: 'IL' },
      { name: 'Carlos Rodón',           slot: 'IL' },
      { name: 'Josh Hader',             slot: 'IL' },
      { name: 'Joe Musgrove',           slot: 'IL' },
      { name: 'Bryce Eldridge',         slot: 'NA' },
      { name: 'Josue De Paula',         slot: 'NA' },
      { name: 'Zyhir Hope',             slot: 'NA' },
      { name: 'Sebastian Walcott',      slot: 'NA' },
      { name: 'Lazaro Montes',          slot: 'NA' },
      { name: 'Walker Jenkins',         slot: 'NA' },
    ],
  },
  {
    team: "Tommy's All-Stars",
    players: [
      { name: 'Ivan Herrera',           slot: 'C' },
      { name: 'Pete Alonso',            slot: '1B' },
      { name: 'Cole Young',             slot: '2B' },
      { name: 'Colt Keith',             slot: '3B' },
      { name: 'Bobby Witt Jr.',         slot: 'SS' },
      { name: 'Colson Montgomery',      slot: 'IF' },
      { name: 'Pete Crow-Armstrong',    slot: 'OF' },
      { name: 'Wyatt Langford',         slot: 'OF' },
      { name: 'Jackson Merrill',        slot: 'OF' },
      { name: 'Cam Smith',              slot: 'OF' },
      { name: 'Jacob Wilson',           slot: 'UTIL' },
      { name: 'Jo Adell',              slot: 'UTIL' },
      { name: 'Jarren Duran',           slot: 'UTIL' },
      { name: 'Bryan Woo',              slot: 'SP' },
      { name: 'Shane Baz',              slot: 'SP' },
      { name: 'Bryce Elder',            slot: 'SP' },
      { name: 'Daniel Palencia',        slot: 'RP' },
      { name: 'Mike Burrows',           slot: 'P' },
      { name: 'Brooks Lee',             slot: 'BENCH' },
      { name: 'Kyle Manzardo',          slot: 'BENCH' },
      { name: 'George Kirby',           slot: 'BENCH' },
      { name: 'Yoshinobu Yamamoto',     slot: 'BENCH' },
      { name: 'Bubba Chandler',         slot: 'BENCH' },
      { name: 'Brandon Pfaadt',         slot: 'BENCH' },
      { name: 'Emmet Sheehan',          slot: 'BENCH' },
      { name: 'Jordan Lawlar',          slot: 'IL' },
      { name: 'Matthew Boyd',           slot: 'IL' },
      { name: 'Cade Horton',            slot: 'IL' },
      { name: 'Jared Jones',            slot: 'IL' },
      { name: 'Carson Williams',        slot: 'NA' },
      { name: 'Harry Ford',             slot: 'NA' },
      { name: 'Travis Bazzana',         slot: 'NA' },
      { name: 'Kade Anderson',          slot: 'NA' },
      { name: 'Noah Schultz',           slot: 'NA' },
      { name: 'River Ryan',             slot: 'NA' },
    ],
  },
  {
    team: "Timmy T's Swingers",
    players: [
      { name: 'Drake Baldwin',          slot: 'C' },
      { name: 'TJ Rumfield',            slot: '1B' },
      { name: 'Xavier Edwards',         slot: '2B' },
      { name: 'Kazuma Okamoto',         slot: '3B' },
      { name: 'Ezequiel Tovar',         slot: 'SS' },
      { name: 'Michael Busch',          slot: 'IF' },
      { name: 'Justin Crawford',        slot: 'OF' },
      { name: 'Alec Burleson',          slot: 'OF' },
      { name: 'Ceddanne Rafaela',       slot: 'OF' },
      { name: "Ryan O'Hearn",           slot: 'OF' },
      { name: 'CJ Abrams',              slot: 'UTIL' },
      { name: 'Miguel Vargas',          slot: 'UTIL' },
      { name: 'Moisés Ballesteros',     slot: 'UTIL' },
      { name: 'Cole Ragans',            slot: 'SP' },
      { name: 'Rhett Lowder',           slot: 'SP' },
      { name: 'Mick Abel',              slot: 'SP' },
      { name: 'Edwin Díaz',             slot: 'RP' },
      { name: 'Jhoan Duran',            slot: 'P' },
      { name: 'Isaac Paredes',          slot: 'BENCH' },
      { name: 'Reid Detmers',           slot: 'BENCH' },
      { name: 'Brady Singer',           slot: 'BENCH' },
      { name: 'Framber Valdez',         slot: 'BENCH' },
      { name: 'Taj Bradley',            slot: 'BENCH' },
      { name: 'Braxton Ashcraft',       slot: 'BENCH' },
      { name: 'José Soriano',           slot: 'BENCH' },
      { name: 'Roki Sasaki',            slot: 'BENCH' },
      { name: 'Juan Soto',              slot: 'IL' },
      { name: 'Triston Casas',          slot: 'IL' },
      { name: 'Grayson Rodriguez',      slot: 'IL' },
      { name: 'Corbin Burnes',          slot: 'IL' },
      { name: 'Edward Florentino',      slot: 'NA' },
      { name: 'Jett Williams',          slot: 'NA' },
      { name: 'George Lombard Jr.',     slot: 'NA' },
      { name: 'Ryan Waldschmidt',       slot: 'NA' },
      { name: 'Spencer Jones',          slot: 'NA' },
      { name: 'Logan Henderson',        slot: 'NA' },
    ],
  },
  {
    team: 'Taichou Big Trees',
    players: [
      { name: 'Austin Wells',           slot: 'C' },
      { name: 'Matt Olson',             slot: '1B' },
      { name: 'Nico Hoerner',           slot: '2B' },
      { name: 'Matt Chapman',           slot: '3B' },
      { name: 'Willy Adames',           slot: 'SS' },
      { name: 'Dansby Swanson',         slot: 'IF' },
      { name: 'Taylor Ward',            slot: 'OF' },
      { name: 'Wilyer Abreu',           slot: 'OF' },
      { name: 'Brendan Donovan',        slot: 'OF' },
      { name: 'Spencer Torkelson',      slot: 'UTIL' },
      { name: 'Eugenio Suárez',         slot: 'UTIL' },
      { name: 'Carlos Correa',          slot: 'UTIL' },
      { name: 'Shota Imanaga',          slot: 'SP' },
      { name: 'Jack Kochanowicz',       slot: 'SP' },
      { name: 'Jesús Luzardo',          slot: 'SP' },
      { name: 'Abner Uribe',            slot: 'RP' },
      { name: 'Andrés Muñoz',           slot: 'P' },
      { name: 'Hunter Goodman',         slot: 'BENCH' },
      { name: 'Mason Miller',           slot: 'BENCH' },
      { name: 'Jeffrey Springs',        slot: 'BENCH' },
      { name: 'Sonny Gray',             slot: 'BENCH' },
      { name: 'Kevin Gausman',          slot: 'BENCH' },
      { name: 'Lance McCullers Jr.',    slot: 'BENCH' },
      { name: 'Drew Rasmussen',         slot: 'BENCH' },
      { name: 'Edward Cabrera',         slot: 'BENCH' },
      { name: 'Brent Rooker',           slot: 'IL' },
      { name: 'Addison Barger',         slot: 'IL' },
      { name: 'Bryce Miller',           slot: 'IL' },
      { name: 'Jonny Farmelo',          slot: 'NA' },
      { name: 'Aidan Miller',           slot: 'NA' },
      { name: 'Braden Montgomery',      slot: 'NA' },
      { name: 'Eduardo Quintero',       slot: 'NA' },
      { name: 'Aiva Arquette',          slot: 'NA' },
      { name: 'Robby Snelling',         slot: 'NA' },
    ],
  },
]

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const { league_id } = await request.json()
  if (!league_id) return NextResponse.json({ error: 'league_id required' }, { status: 400 })

  // Fetch all teams in league
  const { data: dbTeams } = await supabase
    .from('fantasy_teams')
    .select('id, name')
    .eq('league_id', league_id)

  if (!dbTeams || dbTeams.length === 0) {
    return NextResponse.json({ error: 'No teams found in league' }, { status: 404 })
  }

  // Fetch all players (we'll match by name)
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, full_name, mlb_id')

  if (!dbPlayers || dbPlayers.length === 0) {
    return NextResponse.json({ error: 'No players in DB — run MLB Player Sync first' }, { status: 404 })
  }

  // Build name → player lookup (lowercase for matching)
  const playerByName = new Map<string, { id: string; full_name: string }>()
  for (const p of dbPlayers) {
    playerByName.set(p.full_name.toLowerCase(), p)
  }

  const report: {
    team: string
    status: 'ok' | 'team_not_found'
    inserted: number
    not_found: string[]
  }[] = []

  for (const teamData of ROSTER_DATA) {
    const dbTeam = dbTeams.find(t =>
      t.name.toLowerCase() === teamData.team.toLowerCase()
    )

    if (!dbTeam) {
      report.push({ team: teamData.team, status: 'team_not_found', inserted: 0, not_found: [] })
      continue
    }

    // Clear existing roster for this team
    await supabase.from('rosters').delete().eq('team_id', dbTeam.id)

    const notFound: string[] = []
    const rows: { team_id: string; player_id: string; slot_type: string; acquisition_type: string; acquired_at: string }[] = []

    for (const p of teamData.players) {
      const match = playerByName.get(p.name.toLowerCase())
      if (!match) {
        // Try partial match (first + last name)
        const partial = [...playerByName.entries()].find(([k]) => k.startsWith(p.name.toLowerCase().split(' ')[0]) && k.includes(p.name.toLowerCase().split(' ').at(-1) ?? ''))
        if (partial) {
          rows.push({
            team_id: dbTeam.id,
            player_id: partial[1].id,
            slot_type: p.slot,
            acquisition_type: 'draft',
            acquired_at: new Date().toISOString(),
          })
        } else {
          notFound.push(p.name)
        }
      } else {
        rows.push({
          team_id: dbTeam.id,
          player_id: match.id,
          slot_type: p.slot,
          acquisition_type: 'draft',
          acquired_at: new Date().toISOString(),
        })
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('rosters').insert(rows)
      if (error) {
        report.push({ team: teamData.team, status: 'ok', inserted: 0, not_found: [error.message] })
        continue
      }
    }

    report.push({
      team: teamData.team,
      status: 'ok',
      inserted: rows.length,
      not_found: notFound,
    })
  }

  return NextResponse.json({ ok: true, report })
}
