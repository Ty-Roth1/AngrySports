import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/admin/import-yahoo-rosters
// Body: { league_id: string }
//
// Imports Yahoo Fantasy Baseball rosters (2025 season, hardcoded from PDF) into the
// rosters table. Requires an authenticated user. Uses admin client for DB writes.
//
// Logic:
//  1. Auth-gate: reject unauthenticated requests.
//  2. Look up each fantasy team by name (case-insensitive).
//  3. Skip players that are already rostered on any team in the league.
//  4. Match players by full_name (ilike). If multiple hits, disambiguate by mlb_team.
//  5. Insert missing rows; return a summary.

// ---------------------------------------------------------------------------
// Roster data extracted from PDF — 10 teams
// Each entry: { name, slot, mlb_team? }
// mlb_team is only required where disambiguation is needed (duplicate player names
// across teams with different teams, e.g. Max Muncy LAD vs ATH).
// ---------------------------------------------------------------------------

type PlayerEntry = {
  name: string
  slot: string
  mlb_team?: string
}

type TeamRoster = {
  team: string
  players: PlayerEntry[]
}

const ROSTER_DATA: TeamRoster[] = [
  {
    team: 'Corleone Giocatori',
    players: [
      { name: 'Agustín Ramírez',    slot: 'C',     mlb_team: 'MIA' },
      { name: 'Freddie Freeman',     slot: '1B',    mlb_team: 'LAD' },
      { name: 'Brandon Lowe',        slot: '2B',    mlb_team: 'PIT' },
      { name: 'Nolan Arenado',       slot: '3B',    mlb_team: 'AZ'  },
      { name: 'Zach Neto',           slot: 'SS',    mlb_team: 'LAA' },
      { name: 'Gleyber Torres',      slot: 'IF',    mlb_team: 'DET' },
      { name: 'Jac Caglianone',      slot: 'OF',    mlb_team: 'KC'  },
      { name: 'Riley Greene',        slot: 'OF',    mlb_team: 'DET' },
      { name: 'Bryan Reynolds',      slot: 'OF',    mlb_team: 'PIT' },
      { name: 'Carson Benge',        slot: 'OF',    mlb_team: 'NYM' },
      { name: 'George Springer',     slot: 'UTIL',  mlb_team: 'TOR' },
      { name: 'Mike Trout',          slot: 'UTIL',  mlb_team: 'LAA' },
      { name: 'James Wood',          slot: 'UTIL',  mlb_team: 'WSH' },
      { name: 'Seth Lugo',           slot: 'SP',    mlb_team: 'KC'  },
      { name: 'Eury Pérez',          slot: 'SP',    mlb_team: 'MIA' },
      { name: 'Luis Severino',       slot: 'SP',    mlb_team: 'ATH' },
      { name: 'Aroldis Chapman',     slot: 'RP',    mlb_team: 'BOS' },
      { name: 'Kyle Harrison',       slot: 'P',     mlb_team: 'MIL' },
      { name: 'Trevor Story',        slot: 'BENCH', mlb_team: 'BOS' },
      { name: 'Konnor Griffin',      slot: 'BENCH', mlb_team: 'PIT' },
      { name: 'Jackson Holliday',    slot: 'IL',    mlb_team: 'BAL' },
      { name: 'Emmanuel Rodriguez',  slot: 'NA',    mlb_team: 'MIN' },
      { name: 'Leo De Vries',        slot: 'NA',    mlb_team: 'ATH' },
      { name: 'Max Clark',           slot: 'NA',    mlb_team: 'DET' },
      { name: 'Luis Peña',           slot: 'NA',    mlb_team: 'MIL' },
    ],
  },
  {
    team: "Dee's Dreams",
    players: [
      { name: 'Cal Raleigh',         slot: 'C',     mlb_team: 'SEA' },
      { name: 'Bryce Harper',        slot: '1B',    mlb_team: 'PHI' },
      { name: 'Ketel Marte',         slot: '2B',    mlb_team: 'AZ'  },
      { name: 'Max Muncy',           slot: '3B',    mlb_team: 'LAD' }, // LAD — not to be confused with ATH Max Muncy
      { name: 'Corey Seager',        slot: 'SS',    mlb_team: 'TEX' },
      { name: 'Jonathan Aranda',     slot: 'IF',    mlb_team: 'TB'  },
      { name: 'Oneil Cruz',          slot: 'OF',    mlb_team: 'PIT' },
      { name: 'Luis Robert Jr.',     slot: 'OF',    mlb_team: 'NYM' },
      { name: 'Julio Rodríguez',     slot: 'OF',    mlb_team: 'SEA' },
      { name: 'Byron Buxton',        slot: 'OF',    mlb_team: 'MIN' },
      { name: 'Shohei Ohtani',       slot: 'UTIL',  mlb_team: 'LAD' },
      { name: 'Corbin Carroll',      slot: 'UTIL',  mlb_team: 'AZ'  },
      { name: 'Roman Anthony',       slot: 'UTIL',  mlb_team: 'BOS' },
      { name: 'Nolan McLean',        slot: 'SP',    mlb_team: 'NYM' },
      { name: 'Randy Vásquez',       slot: 'SP',    mlb_team: 'SD'  },
      { name: 'Luis Castillo',       slot: 'SP',    mlb_team: 'SEA' },
      { name: 'Chase Burns',         slot: 'RP',    mlb_team: 'CIN' },
      { name: 'Cam Schlittler',      slot: 'P',     mlb_team: 'NYY' },
      { name: 'Xander Bogaerts',     slot: 'BENCH', mlb_team: 'SD'  },
      { name: 'Seiya Suzuki',        slot: 'BENCH', mlb_team: 'CHC' },
      { name: 'Royce Lewis',         slot: 'IL',    mlb_team: 'MIN' },
      { name: 'Colt Emerson',        slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Franklin Arias',      slot: 'NA',    mlb_team: 'BOS' },
      { name: 'Josuar Gonzalez',     slot: 'NA',    mlb_team: 'SF'  },
      { name: 'James Tibbs III',     slot: 'NA',    mlb_team: 'LAD' },
    ],
  },
  {
    team: 'Hospital on Guerrero',
    players: [
      { name: 'Liam Hicks',              slot: 'C',     mlb_team: 'MIA' },
      { name: 'Vladimir Guerrero Jr.',   slot: '1B',    mlb_team: 'TOR' },
      { name: 'Jazz Chisholm Jr.',       slot: '2B',    mlb_team: 'NYY' },
      { name: 'José Ramírez',            slot: '3B',    mlb_team: 'CLE' },
      { name: 'Kevin McGonigle',         slot: 'SS',    mlb_team: 'DET' },
      { name: 'Vinnie Pasquantino',      slot: 'IF',    mlb_team: 'KC'  },
      { name: 'Daylen Lile',             slot: 'OF',    mlb_team: 'WSH' },
      { name: 'Kyle Tucker',             slot: 'OF',    mlb_team: 'LAD' },
      { name: 'Cody Bellinger',          slot: 'OF',    mlb_team: 'NYY' },
      { name: 'Andy Pages',              slot: 'OF',    mlb_team: 'LAD' },
      { name: 'Carter Jensen',           slot: 'UTIL',  mlb_team: 'KC'  },
      { name: 'Elly De La Cruz',         slot: 'UTIL',  mlb_team: 'CIN' },
      { name: 'Mickey Moniak',           slot: 'UTIL',  mlb_team: 'COL' },
      { name: 'Jonah Tong',              slot: 'SP',    mlb_team: 'NYM' },
      { name: 'Emerson Hancock',         slot: 'SP',    mlb_team: 'SEA' },
      { name: 'Jack Leiter',             slot: 'SP',    mlb_team: 'TEX' },
      { name: 'David Bednar',            slot: 'RP',    mlb_team: 'NYY' },
      { name: 'Jaxon Wiggins',           slot: 'P',     mlb_team: 'CHC' },
      { name: 'Jeremy Peña',             slot: 'BENCH', mlb_team: 'HOU' },
      { name: 'Jacob deGrom',            slot: 'BENCH', mlb_team: 'TEX' },
      { name: 'Paul Skenes',             slot: 'BENCH', mlb_team: 'PIT' },
      { name: 'Garrett Crochet',         slot: 'BENCH', mlb_team: 'BOS' },
      { name: 'Brandon Woodruff',        slot: 'BENCH', mlb_team: 'MIL' },
      { name: 'Andrew Painter',          slot: 'BENCH', mlb_team: 'PHI' },
      { name: 'Merrill Kelly',           slot: 'IL',    mlb_team: 'AZ'  },
      { name: 'Zack Wheeler',            slot: 'IL',    mlb_team: 'PHI' },
      { name: 'Blake Snell',             slot: 'IL',    mlb_team: 'LAD' },
      { name: 'Hunter Greene',           slot: 'IL',    mlb_team: 'CIN' },
      { name: 'José Berríos',            slot: 'IL',    mlb_team: 'TOR' },
      { name: 'Zach Eflin',              slot: 'IL',    mlb_team: 'BAL' },
      { name: 'Luis Gil',                slot: 'NA',    mlb_team: 'NYY' },
      { name: 'Jasson Domínguez',        slot: 'NA',    mlb_team: 'NYY' },
      { name: 'Jesús Made',              slot: 'NA',    mlb_team: 'MIL' },
    ],
  },
  {
    team: "Jeff Seager's Sperm",
    players: [
      { name: 'Will Smith',              slot: 'C',     mlb_team: 'LAD' },
      { name: 'Rafael Devers',           slot: '1B',    mlb_team: 'SF'  },
      { name: 'Jose Altuve',             slot: '2B',    mlb_team: 'HOU' },
      { name: 'Alex Bregman',            slot: '3B',    mlb_team: 'CHC' },
      { name: 'Trea Turner',             slot: 'SS',    mlb_team: 'PHI' },
      { name: 'Francisco Lindor',        slot: 'IF',    mlb_team: 'NYM' },
      { name: 'Aaron Judge',             slot: 'OF',    mlb_team: 'NYY' },
      { name: 'Kyle Schwarber',          slot: 'OF',    mlb_team: 'PHI' },
      { name: 'Lawrence Butler',         slot: 'OF',    mlb_team: 'ATH' },
      { name: 'Kerry Carpenter',         slot: 'OF',    mlb_team: 'DET' },
      { name: 'Max Muncy',               slot: 'UTIL',  mlb_team: 'ATH' }, // ATH — not to be confused with LAD Max Muncy
      { name: 'Yandy Díaz',              slot: 'UTIL',  mlb_team: 'TB'  },
      { name: 'Christian Walker',        slot: 'UTIL',  mlb_team: 'HOU' },
      { name: 'Davis Martin',            slot: 'SP',    mlb_team: 'CWS' },
      { name: 'Logan Webb',              slot: 'SP',    mlb_team: 'SF'  },
      { name: 'Brandon Williamson',      slot: 'SP',    mlb_team: 'CIN' },
      { name: 'Jeff Hoffman',            slot: 'RP',    mlb_team: 'TOR' },
      { name: 'Raisel Iglesias',         slot: 'P',     mlb_team: 'ATL' },
      { name: 'Trent Grisham',           slot: 'BENCH', mlb_team: 'NYY' },
      { name: 'Geraldo Perdomo',         slot: 'BENCH', mlb_team: 'AZ'  },
      { name: 'Ryan Weathers',           slot: 'BENCH', mlb_team: 'NYY' },
      { name: 'Freddy Peralta',          slot: 'BENCH', mlb_team: 'NYM' },
      { name: 'Michael King',            slot: 'BENCH', mlb_team: 'SD'  },
      { name: 'Robbie Ray',              slot: 'BENCH', mlb_team: 'SF'  },
      { name: 'Cristopher Sánchez',      slot: 'BENCH', mlb_team: 'PHI' },
      { name: 'Ryan Pepiot',             slot: 'IL',    mlb_team: 'TB'  },
      { name: 'Jackson Jobe',            slot: 'IL',    mlb_team: 'DET' },
      { name: 'Felnin Celesten',         slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Ryan Sloan',              slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Liam Doyle',              slot: 'NA',    mlb_team: 'STL' },
    ],
  },
  {
    team: 'Men of Faith',
    players: [
      { name: 'William Contreras',       slot: 'C',     mlb_team: 'MIL' },
      { name: 'Willson Contreras',       slot: '1B',    mlb_team: 'BOS' },
      { name: 'Mauricio Dubón',          slot: '2B',    mlb_team: 'ATL' },
      { name: 'Manny Machado',           slot: '3B',    mlb_team: 'SD'  },
      { name: 'Ernie Clement',           slot: 'SS',    mlb_team: 'TOR' },
      { name: 'Marcus Semien',           slot: 'IF',    mlb_team: 'NYM' },
      { name: 'Randy Arozarena',         slot: 'OF',    mlb_team: 'SEA' },
      { name: 'Christian Yelich',        slot: 'OF',    mlb_team: 'MIL' },
      { name: 'Brandon Nimmo',           slot: 'OF',    mlb_team: 'TEX' },
      { name: 'Giancarlo Stanton',       slot: 'OF',    mlb_team: 'NYY' },
      { name: 'Brice Turang',            slot: 'UTIL',  mlb_team: 'MIL' },
      { name: 'Teoscar Hernández',       slot: 'UTIL',  mlb_team: 'LAD' },
      { name: 'Ian Happ',                slot: 'UTIL',  mlb_team: 'CHC' },
      { name: 'Michael Wacha',           slot: 'SP',    mlb_team: 'KC'  },
      { name: 'Eric Lauer',              slot: 'SP',    mlb_team: 'TOR' },
      { name: 'Max Fried',               slot: 'SP',    mlb_team: 'NYY' },
      { name: 'Devin Williams',          slot: 'RP',    mlb_team: 'NYM' },
      { name: 'Gavin Williams',          slot: 'P',     mlb_team: 'CLE' },
      { name: 'Marcelo Mayer',           slot: 'BENCH', mlb_team: 'BOS' },
      { name: 'Mitch Keller',            slot: 'BENCH', mlb_team: 'PIT' },
      { name: 'Tyler Glasnow',           slot: 'BENCH', mlb_team: 'LAD' },
      { name: 'Jackson Chourio',         slot: 'IL',    mlb_team: 'MIL' },
      { name: 'Kristian Campbell',       slot: 'NA',    mlb_team: 'BOS' },
      { name: 'Eli Willits',             slot: 'NA',    mlb_team: 'WSH' },
      { name: 'Yorger Bautista',         slot: 'NA',    mlb_team: 'SEA' },
    ],
  },
  {
    team: 'Mr. T-Ballers',
    players: [
      { name: 'Samuel Basallo',          slot: 'C',     mlb_team: 'BAL' },
      { name: 'Munetaka Murakami',       slot: '1B',    mlb_team: 'CWS' },
      { name: 'Ozzie Albies',            slot: '2B',    mlb_team: 'ATL' },
      { name: 'JJ Wetherholt',           slot: '3B',    mlb_team: 'STL' },
      { name: 'Gunnar Henderson',        slot: 'SS',    mlb_team: 'BAL' },
      { name: 'Josh Naylor',             slot: 'IF',    mlb_team: 'SEA' },
      { name: 'Ronald Acuña Jr.',        slot: 'OF',    mlb_team: 'ATL' },
      { name: 'Michael Harris II',       slot: 'OF',    mlb_team: 'ATL' },
      { name: 'Fernando Tatis Jr.',      slot: 'OF',    mlb_team: 'SD'  },
      { name: 'Chase DeLauter',          slot: 'OF',    mlb_team: 'CLE' },
      { name: 'Austin Riley',            slot: 'UTIL',  mlb_team: 'ATL' },
      { name: 'Luke Keaschall',          slot: 'UTIL',  mlb_team: 'MIN' },
      { name: 'Owen Caissie',            slot: 'UTIL',  mlb_team: 'MIA' },
      { name: 'Casey Mize',              slot: 'SP',    mlb_team: 'DET' },
      { name: 'Parker Messick',          slot: 'SP',    mlb_team: 'CLE' },
      { name: 'Ranger Suarez',           slot: 'SP',    mlb_team: 'BOS' },
      { name: 'Noah Cameron',            slot: 'P',     mlb_team: 'KC'  },
      { name: 'Chad Patrick',            slot: 'BENCH', mlb_team: 'MIL' },
      { name: 'Kris Bubic',              slot: 'BENCH', mlb_team: 'KC'  },
      { name: 'Eduardo Rodriguez',       slot: 'BENCH', mlb_team: 'AZ'  },
      { name: 'Aaron Nola',              slot: 'BENCH', mlb_team: 'PHI' },
      { name: 'Adley Rutschman',         slot: 'IL',    mlb_team: 'BAL' },
      { name: 'Ethan Holliday',          slot: 'NA',    mlb_team: 'COL' },
      { name: 'Joshua Baez',             slot: 'NA',    mlb_team: 'STL' },
      { name: 'Bryce Rainer',            slot: 'NA',    mlb_team: 'DET' },
    ],
  },
  {
    team: "OG's Farm Team",
    players: [
      { name: 'Shea Langeliers',         slot: 'C',     mlb_team: 'ATH' },
      { name: 'Ben Rice',                slot: '1B',    mlb_team: 'NYY' },
      { name: 'Maikel Garcia',           slot: '2B',    mlb_team: 'KC'  },
      { name: 'Junior Caminero',         slot: '3B',    mlb_team: 'TB'  },
      { name: 'Bo Bichette',             slot: 'SS',    mlb_team: 'NYM' },
      { name: 'Sal Stewart',             slot: 'IF',    mlb_team: 'CIN' },
      { name: 'Yordan Alvarez',          slot: 'OF',    mlb_team: 'HOU' },
      { name: 'Jakob Marsee',            slot: 'OF',    mlb_team: 'MIA' },
      { name: 'Tyler Soderstrom',        slot: 'OF',    mlb_team: 'ATH' },
      { name: 'Steven Kwan',             slot: 'OF',    mlb_team: 'CLE' },
      { name: 'Jordan Walker',           slot: 'OF',    mlb_team: 'STL' },
      { name: 'Brady House',             slot: 'UTIL',  mlb_team: 'WSH' },
      { name: 'Nick Kurtz',              slot: 'UTIL',  mlb_team: 'ATH' },
      { name: 'Kodai Senga',             slot: 'SP',    mlb_team: 'NYM' },
      { name: 'Joe Ryan',                slot: 'SP',    mlb_team: 'MIN' },
      { name: 'Tanner Bibee',            slot: 'SP',    mlb_team: 'CLE' },
      { name: 'Cade Smith',              slot: 'RP',    mlb_team: 'CLE' },
      { name: 'Ryan Helsley',            slot: 'P',     mlb_team: 'BAL' },
      { name: 'Matt McLain',             slot: 'BENCH', mlb_team: 'CIN' },
      { name: 'Andrew Abbott',           slot: 'BENCH', mlb_team: 'CIN' },
      { name: 'Yusei Kikuchi',           slot: 'BENCH', mlb_team: 'LAA' },
      { name: 'Nathan Eovaldi',          slot: 'BENCH', mlb_team: 'TEX' },
      { name: 'Logan Gilbert',           slot: 'BENCH', mlb_team: 'SEA' },
      { name: 'Jameson Taillon',         slot: 'BENCH', mlb_team: 'CHC' },
      { name: 'Tatsuya Imai',            slot: 'BENCH', mlb_team: 'HOU' },
      { name: 'Mookie Betts',            slot: 'IL',    mlb_team: 'LAD' },
      { name: 'Kyle Stowers',            slot: 'IL',    mlb_team: 'MIA' },
      { name: 'Jordan Westburg',         slot: 'IL',    mlb_team: 'BAL' },
      { name: 'Cody Ponce',              slot: 'IL',    mlb_team: 'TOR' },
      { name: 'Bryce Eldridge',          slot: 'NA',    mlb_team: 'SF'  },
      { name: 'Josue De Paula',          slot: 'NA',    mlb_team: 'LAD' },
      { name: 'Zyhir Hope',              slot: 'NA',    mlb_team: 'LAD' },
      { name: 'Sebastian Walcott',       slot: 'NA',    mlb_team: 'TEX' },
      { name: 'Lazaro Montes',           slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Walker Jenkins',          slot: 'NA',    mlb_team: 'MIN' },
      { name: 'Jamie Arnold',            slot: 'NA',    mlb_team: 'ATH' },
      { name: 'Carlos Lagrange',         slot: 'NA',    mlb_team: 'NYY' },
    ],
  },
  {
    team: "Tommy's All-Stars",
    players: [
      { name: 'Ivan Herrera',            slot: 'C',     mlb_team: 'STL' },
      { name: 'Pete Alonso',             slot: '1B',    mlb_team: 'BAL' },
      { name: 'Cole Young',              slot: '2B',    mlb_team: 'SEA' },
      { name: 'Colt Keith',              slot: '3B',    mlb_team: 'DET' },
      { name: 'Bobby Witt Jr.',          slot: 'SS',    mlb_team: 'KC'  },
      { name: 'Colson Montgomery',       slot: 'IF',    mlb_team: 'CWS' },
      { name: 'Pete Crow-Armstrong',     slot: 'OF',    mlb_team: 'CHC' },
      { name: 'Jackson Merrill',         slot: 'OF',    mlb_team: 'SD'  },
      { name: 'Cam Smith',               slot: 'OF',    mlb_team: 'HOU' },
      { name: 'Jarren Duran',            slot: 'OF',    mlb_team: 'BOS' },
      { name: 'Jacob Wilson',            slot: 'UTIL',  mlb_team: 'ATH' },
      { name: 'Jo Adell',                slot: 'UTIL',  mlb_team: 'LAA' },
      { name: 'Brooks Lee',              slot: 'UTIL',  mlb_team: 'MIN' },
      { name: 'Bryan Woo',               slot: 'SP',    mlb_team: 'SEA' },
      { name: 'Brandon Pfaadt',          slot: 'SP',    mlb_team: 'AZ'  },
      { name: 'Emmet Sheehan',           slot: 'SP',    mlb_team: 'LAD' },
      { name: 'Daniel Palencia',         slot: 'RP',    mlb_team: 'CHC' },
      { name: 'Bryce Elder',             slot: 'P',     mlb_team: 'ATL' },
      { name: 'Wyatt Langford',          slot: 'BENCH', mlb_team: 'TEX' },
      { name: 'Kyle Manzardo',           slot: 'BENCH', mlb_team: 'CLE' },
      { name: 'Shane Baz',               slot: 'BENCH', mlb_team: 'BAL' },
      { name: 'Mike Burrows',            slot: 'BENCH', mlb_team: 'HOU' },
      { name: 'George Kirby',            slot: 'BENCH', mlb_team: 'SEA' },
      { name: 'Yoshinobu Yamamoto',      slot: 'BENCH', mlb_team: 'LAD' },
      { name: 'Bubba Chandler',          slot: 'BENCH', mlb_team: 'PIT' },
      { name: 'Jordan Lawlar',           slot: 'IL',    mlb_team: 'AZ'  },
      { name: 'Matthew Boyd',            slot: 'IL',    mlb_team: 'DET' }, // Only on Tommy's — see note re: PDF parsing error
      { name: 'Carson Williams',         slot: 'NA',    mlb_team: 'TB'  },
      { name: 'Harry Ford',              slot: 'NA',    mlb_team: 'WSH' },
      { name: 'Travis Bazzana',          slot: 'NA',    mlb_team: 'CLE' },
    ],
  },
  {
    team: "Timmy T's Swingers",
    players: [
      { name: 'Drake Baldwin',           slot: 'C',     mlb_team: 'ATL' },
      { name: 'TJ Rumfield',             slot: '1B',    mlb_team: 'COL' },
      { name: 'Xavier Edwards',          slot: '2B',    mlb_team: 'MIA' },
      { name: 'Kazuma Okamoto',          slot: '3B',    mlb_team: 'TOR' },
      { name: 'Ezequiel Tovar',          slot: 'SS',    mlb_team: 'COL' },
      { name: 'Michael Busch',           slot: 'IF',    mlb_team: 'CHC' },
      { name: 'Justin Crawford',         slot: 'OF',    mlb_team: 'PHI' },
      { name: 'Alec Burleson',           slot: 'OF',    mlb_team: 'STL' },
      { name: 'Ceddanne Rafaela',        slot: 'OF',    mlb_team: 'BOS' },
      { name: "Ryan O'Hearn",            slot: 'OF',    mlb_team: 'PIT' },
      { name: 'CJ Abrams',               slot: 'UTIL',  mlb_team: 'WSH' },
      { name: 'Miguel Vargas',           slot: 'UTIL',  mlb_team: 'CWS' },
      { name: 'Isaac Paredes',           slot: 'UTIL',  mlb_team: 'HOU' },
      { name: 'Mick Abel',               slot: 'SP',    mlb_team: 'MIN' },
      { name: 'Roki Sasaki',             slot: 'SP',    mlb_team: 'LAD' },
      { name: 'Braxton Ashcraft',        slot: 'SP',    mlb_team: 'PIT' },
      { name: 'Edwin Díaz',              slot: 'RP',    mlb_team: 'LAD' },
      { name: 'Jhoan Duran',             slot: 'P',     mlb_team: 'PHI' },
      { name: 'Moisés Ballesteros',      slot: 'BENCH', mlb_team: 'CHC' },
      { name: 'Rhett Lowder',            slot: 'BENCH', mlb_team: 'CIN' },
      { name: 'Cole Ragans',             slot: 'BENCH', mlb_team: 'KC'  },
      { name: 'Reid Detmers',            slot: 'BENCH', mlb_team: 'LAA' },
      { name: 'Brady Singer',            slot: 'BENCH', mlb_team: 'CIN' },
      { name: 'Framber Valdez',          slot: 'BENCH', mlb_team: 'DET' },
      { name: 'Juan Soto',               slot: 'IL',    mlb_team: 'NYM' },
      { name: 'Triston Casas',           slot: 'IL',    mlb_team: 'BOS' },
      { name: 'Pablo López',             slot: 'IL',    mlb_team: 'MIN' },
      { name: 'Carlos Rodón',            slot: 'IL',    mlb_team: 'NYY' },
      { name: 'Josh Hader',              slot: 'IL',    mlb_team: 'HOU' },
      { name: 'Joe Musgrove',            slot: 'IL',    mlb_team: 'SD'  },
      { name: 'Edward Florentino',       slot: 'NA',    mlb_team: 'PIT' },
      { name: 'Jett Williams',           slot: 'NA',    mlb_team: 'MIL' },
      { name: 'George Lombard Jr.',      slot: 'NA',    mlb_team: 'NYY' },
      { name: 'Ryan Waldschmidt',        slot: 'NA',    mlb_team: 'AZ'  },
      { name: 'Spencer Jones',           slot: 'NA',    mlb_team: 'NYY' },
    ],
  },
  {
    team: 'Taichou Big Trees',
    players: [
      { name: 'Hunter Goodman',          slot: 'C',     mlb_team: 'COL' },
      { name: 'Matt Olson',              slot: '1B',    mlb_team: 'ATL' },
      { name: 'Nico Hoerner',            slot: '2B',    mlb_team: 'CHC' },
      { name: 'Matt Chapman',            slot: '3B',    mlb_team: 'SF'  },
      { name: 'Willy Adames',            slot: 'SS',    mlb_team: 'SF'  },
      { name: 'Dansby Swanson',          slot: 'IF',    mlb_team: 'CHC' },
      { name: 'Taylor Ward',             slot: 'OF',    mlb_team: 'BAL' },
      { name: 'Wilyer Abreu',            slot: 'OF',    mlb_team: 'BOS' },
      { name: 'Brendan Donovan',         slot: 'OF',    mlb_team: 'SEA' },
      { name: 'Jorge Soler',             slot: 'OF',    mlb_team: 'LAA' },
      { name: 'Spencer Torkelson',       slot: 'UTIL',  mlb_team: 'DET' },
      { name: 'Eugenio Suárez',          slot: 'UTIL',  mlb_team: 'CIN' },
      { name: 'Carlos Correa',           slot: 'UTIL',  mlb_team: 'HOU' },
      { name: 'Jesús Luzardo',           slot: 'SP',    mlb_team: 'PHI' },
      { name: 'Lance McCullers Jr.',     slot: 'SP',    mlb_team: 'HOU' },
      { name: 'Edward Cabrera',          slot: 'SP',    mlb_team: 'CHC' },
      { name: 'Abner Uribe',             slot: 'RP',    mlb_team: 'MIL' },
      { name: 'Andrés Muñoz',            slot: 'P',     mlb_team: 'SEA' },
      { name: 'Austin Wells',            slot: 'BENCH', mlb_team: 'NYY' },
      { name: 'Jack Kochanowicz',        slot: 'BENCH', mlb_team: 'LAA' },
      { name: 'Shota Imanaga',           slot: 'BENCH', mlb_team: 'CHC' },
      { name: 'Mason Miller',            slot: 'BENCH', mlb_team: 'SD'  },
      { name: 'Jeffrey Springs',         slot: 'BENCH', mlb_team: 'ATH' },
      { name: 'Sonny Gray',              slot: 'BENCH', mlb_team: 'BOS' },
      { name: 'Taj Bradley',             slot: 'BENCH', mlb_team: 'MIN' },
      { name: 'José Soriano',            slot: 'BENCH', mlb_team: 'LAA' },
      { name: 'Kevin Gausman',           slot: 'BENCH', mlb_team: 'TOR' },
      { name: 'Brent Rooker',            slot: 'IL',    mlb_team: 'ATH' },
      { name: 'Addison Barger',          slot: 'IL',    mlb_team: 'TOR' },
      { name: 'Grayson Rodriguez',       slot: 'IL',    mlb_team: 'LAA' },
      { name: 'Corbin Burnes',           slot: 'IL',    mlb_team: 'AZ'  },
      { name: 'Cade Horton',             slot: 'IL',    mlb_team: 'CHC' },
      { name: 'Jared Jones',             slot: 'IL',    mlb_team: 'PIT' },
      // Matthew Boyd intentionally omitted — PDF parsing error; assigned to Tommy's All-Stars only
      { name: 'Jonny Farmelo',           slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Aidan Miller',            slot: 'NA',    mlb_team: 'PHI' },
      { name: 'Braden Montgomery',       slot: 'NA',    mlb_team: 'CWS' },
      { name: 'Eduardo Quintero',        slot: 'NA',    mlb_team: 'LAD' },
      { name: 'Aiva Arquette',           slot: 'NA',    mlb_team: 'MIA' },
      { name: 'Logan Henderson',         slot: 'NA',    mlb_team: 'MIL' },
      { name: 'Robby Snelling',          slot: 'NA',    mlb_team: 'MIA' },
      { name: 'Kade Anderson',           slot: 'NA',    mlb_team: 'SEA' },
      { name: 'Noah Schultz',            slot: 'NA',    mlb_team: 'CWS' },
      { name: 'River Ryan',              slot: 'NA',    mlb_team: 'LAD' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Auth gate — require a valid session
  const userClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let league_id: string | undefined
  try {
    const body = await request.json()
    league_id = body?.league_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!league_id) {
    return NextResponse.json({ error: 'league_id is required' }, { status: 400 })
  }

  // 2. Admin client for all DB writes
  const admin = createAdminClient()

  // 3. Fetch all fantasy teams in this league
  const { data: dbTeams, error: teamsError } = await admin
    .from('fantasy_teams')
    .select('id, name')
    .eq('league_id', league_id)

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 })
  }
  if (!dbTeams || dbTeams.length === 0) {
    return NextResponse.json(
      { error: `No fantasy teams found for league_id=${league_id}` },
      { status: 404 }
    )
  }

  // 4. Fetch all existing rosters for this league to detect already-rostered players
  const teamIds = dbTeams.map((t) => t.id)
  const { data: existingRosters, error: rostersError } = await admin
    .from('rosters')
    .select('player_id, team_id')
    .in('team_id', teamIds)

  if (rostersError) {
    return NextResponse.json({ error: rostersError.message }, { status: 500 })
  }

  const rosteredPlayerIds = new Set((existingRosters ?? []).map((r) => r.player_id))

  // Summary accumulators
  let added = 0
  let skipped = 0
  const notFound: string[] = []
  const alreadyRostered: string[] = []
  const logs: string[] = []

  const acquiredAt = new Date().toISOString()

  // 5. Process each team
  for (const teamData of ROSTER_DATA) {
    // Find matching DB team (case-insensitive)
    const { data: teamRows, error: teamLookupError } = await admin
      .from('fantasy_teams')
      .select('id, name')
      .eq('league_id', league_id)
      .ilike('name', teamData.team)
      .limit(1)

    if (teamLookupError || !teamRows || teamRows.length === 0) {
      logs.push(`WARN: team not found in DB — "${teamData.team}"`)
      skipped += teamData.players.length
      continue
    }

    const dbTeam = teamRows[0]

    for (const entry of teamData.players) {
      // 5a. Search players table by full_name (case-insensitive)
      const { data: playerMatches, error: playerError } = await admin
        .from('players')
        .select('id, full_name, mlb_team')
        .ilike('full_name', entry.name)

      if (playerError) {
        logs.push(`ERROR: DB error looking up "${entry.name}": ${playerError.message}`)
        skipped++
        continue
      }

      if (!playerMatches || playerMatches.length === 0) {
        // 5d. Not found in DB
        logs.push(`NOT FOUND: "${entry.name}" (${entry.mlb_team ?? '?'}) — team "${teamData.team}"`)
        notFound.push(`${entry.name} (${entry.mlb_team ?? '?'})`)
        skipped++
        continue
      }

      // 5b. Disambiguate if multiple matches
      let player = playerMatches[0]
      if (playerMatches.length > 1) {
        if (entry.mlb_team) {
          const byTeam = playerMatches.find(
            (p) => p.mlb_team?.toUpperCase() === entry.mlb_team!.toUpperCase()
          )
          if (byTeam) {
            player = byTeam
            logs.push(
              `DISAMBIGUATED: "${entry.name}" — chose ${player.mlb_team} (${playerMatches.length} matches)`
            )
          } else {
            logs.push(
              `WARN: "${entry.name}" has ${playerMatches.length} matches but none match mlb_team=${entry.mlb_team}; using first result`
            )
          }
        } else {
          logs.push(
            `WARN: "${entry.name}" has ${playerMatches.length} matches and no mlb_team hint; using first result`
          )
        }
      }

      // 5c. Skip if already on any team in this league
      if (rosteredPlayerIds.has(player.id)) {
        logs.push(
          `ALREADY ROSTERED: "${entry.name}" (player_id=${player.id}) — skipping for team "${teamData.team}"`
        )
        alreadyRostered.push(`${entry.name} → ${teamData.team}`)
        skipped++
        continue
      }

      // 5e. Insert into rosters
      const { error: insertError } = await admin.from('rosters').insert({
        team_id: dbTeam.id,
        player_id: player.id,
        slot_type: entry.slot,
        acquisition_type: 'draft',
        acquired_at: acquiredAt,
      })

      if (insertError) {
        logs.push(
          `ERROR: failed to insert "${entry.name}" for team "${teamData.team}": ${insertError.message}`
        )
        skipped++
        continue
      }

      // Track as rostered so subsequent teams don't double-add
      rosteredPlayerIds.add(player.id)
      added++
    }
  }

  // 6. Return summary
  return NextResponse.json({
    ok: true,
    summary: {
      added,
      skipped,
      notFound,
      alreadyRostered,
    },
    logs,
  })
}
