/**
 * Demo odds provider — used when no API key is configured, the key is
 * invalid, or The Odds API is unreachable. Gives the UI fully-functional
 * "bookmaker" data so the whole betting flow can be exercised. Real data
 * replaces this the moment a valid ODDS_API_KEY is in play.
 */

const HOUR = 3600_000;

function iso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * HOUR).toISOString();
}

export const DEMO_SPORTS = [
  { key: "soccer_zambia", title: "Zambia Super League", group: "Soccer", active: true, has_outrights: false, description: "Demo · Zambian top flight" },
  { key: "soccer_epl", title: "English Premier League", group: "Soccer", active: true, has_outrights: false, description: "Demo · England" },
  { key: "basketball_nba", title: "NBA", group: "Basketball", active: true, has_outrights: false, description: "Demo · United States" },
  { key: "americanfootball_nfl", title: "NFL", group: "American Football", active: true, has_outrights: false, description: "Demo · United States" },
  { key: "tennis_atp", title: "Tennis ATP", group: "Tennis", active: true, has_outrights: false, description: "Demo · World Tour" },
  { key: "cricket_odi", title: "Cricket ODI", group: "Cricket", active: true, has_outrights: false, description: "Demo · International" },
  { key: "icehockey_nhl", title: "NHL", group: "Ice Hockey", active: true, has_outrights: false, description: "Demo · North America" },
  { key: "boxing_boxing", title: "Boxing", group: "Combat Sports", active: true, has_outrights: false, description: "Demo · Fights" },
];

type FixtureDef = {
  id: string;
  sport: string;
  home: string;
  away: string;
  offset: number; // hours from now
  odds: [number, number | undefined, number?]; // home, draw(optional), away
  done?: boolean;
  homeScore?: number;
  awayScore?: number;
};

const FIXTURES: FixtureDef[] = [
  // Zambia Super League
  { id: "za1", sport: "soccer_zambia", home: "Zesco United", away: "Power Dynamos", offset: 4, odds: [2.1, 3.1, 3.4] },
  { id: "za2", sport: "soccer_zambia", home: "Green Buffaloes", away: "Nkana", offset: 9, odds: [2.55, 2.95, 2.75] },
  { id: "za3", sport: "soccer_zambia", home: "Zanaco", away: "Forest Rangers", offset: 27, odds: [1.95, 3.2, 3.8] },
  { id: "za4", sport: "soccer_zambia", home: "Red Arrows", away: "Mufulira Wanderers", offset: 31, odds: [1.8, 3.4, 4.2] },
  { id: "za5", sport: "soccer_zambia", home: "Kabwe Warriors", away: "Prison Leopards", offset: -3, odds: [2.3, 3.0, 3.1], done: true, homeScore: 2, awayScore: 1 },
  { id: "za6", sport: "soccer_zambia", home: "Nkwazi", away: "Green Eagles", offset: -5, odds: [2.75, 2.9, 2.6], done: true, homeScore: 0, awayScore: 2 },
  { id: "za7", sport: "soccer_zambia", home: "Nchanga Rangers", away: "Lumwana Radiants", offset: -0.8, odds: [2.4, 3.0, 2.9], homeScore: 1, awayScore: 0 },
  // EPL
  { id: "ep1", sport: "soccer_epl", home: "Arsenal", away: "Chelsea", offset: 6, odds: [2.15, 3.4, 3.2] },
  { id: "ep2", sport: "soccer_epl", home: "Liverpool", away: "Man City", offset: 14, odds: [2.6, 3.4, 2.55] },
  { id: "ep3", sport: "soccer_epl", home: "Man United", away: "Tottenham", offset: 26, odds: [2.3, 3.5, 2.95] },
  { id: "ep4", sport: "soccer_epl", home: "Newcastle", away: "Aston Villa", offset: 50, odds: [2.05, 3.45, 3.4] },
  { id: "ep5", sport: "soccer_epl", home: "Everton", away: "Fulham", offset: -4, odds: [2.6, 3.1, 2.75], done: true, homeScore: 1, awayScore: 1 },
  { id: "ep6", sport: "soccer_epl", home: "Brighton", away: "West Ham", offset: -1.2, odds: [2.2, 3.3, 3.1], homeScore: 2, awayScore: 1 },
  // NBA
  { id: "nb1", sport: "basketball_nba", home: "Lakers", away: "Celtics", offset: 8, odds: [2.05, undefined, 1.8] },
  { id: "nb2", sport: "basketball_nba", home: "Warriors", away: "Suns", offset: 12, odds: [1.95, undefined, 1.88] },
  { id: "nb3", sport: "basketball_nba", home: "Bucks", away: "Nuggets", offset: 30, odds: [2.3, undefined, 1.63] },
  { id: "nb4", sport: "basketball_nba", home: "Knicks", away: "Heat", offset: -6, odds: [1.75, undefined, 2.1], done: true, homeScore: 112, awayScore: 107 },
  { id: "nb5", sport: "basketball_nba", home: "Mavericks", away: "Thunder", offset: -0.5, odds: [1.9, undefined, 1.9], homeScore: 78, awayScore: 74 },
  // NFL
  { id: "nf1", sport: "americanfootball_nfl", home: "Chiefs", away: "Bills", offset: 18, odds: [1.85, undefined, 1.98] },
  { id: "nf2", sport: "americanfootball_nfl", home: "Eagles", away: "Cowboys", offset: 22, odds: [1.72, undefined, 2.15] },
  { id: "nf3", sport: "americanfootball_nfl", home: "49ers", away: "Rams", offset: 44, odds: [1.9, undefined, 1.92] },
  { id: "nf4", sport: "americanfootball_nfl", home: "Lions", away: "Packers", offset: -2, odds: [1.66, undefined, 2.25], done: true, homeScore: 27, awayScore: 24 },
  { id: "nf5", sport: "americanfootball_nfl", home: "Steelers", away: "Bengals", offset: -1.5, odds: [1.8, undefined, 2.05], homeScore: 17, awayScore: 14 },
  // Tennis
  { id: "te1", sport: "tennis_atp", home: "Sinner", away: "Alcaraz", offset: 5, odds: [1.65, undefined, 2.25] },
  { id: "te2", sport: "tennis_atp", home: "Djokovic", away: "Zverev", offset: 16, odds: [1.8, undefined, 2.05] },
  { id: "te3", sport: "tennis_atp", home: "Medvedev", away: "Rune", offset: 40, odds: [2.1, undefined, 1.75] },
  { id: "te4", sport: "tennis_atp", home: "Fritz", away: "De Minaur", offset: -8, odds: [1.9, undefined, 1.92], done: true, homeScore: 2, awayScore: 1 },
  // Cricket
  { id: "cr1", sport: "cricket_odi", home: "India", away: "Australia", offset: 7, odds: [1.72, undefined, 2.1] },
  { id: "cr2", sport: "cricket_odi", home: "England", away: "South Africa", offset: 20, odds: [1.95, undefined, 1.85] },
  { id: "cr3", sport: "cricket_odi", home: "Pakistan", away: "Sri Lanka", offset: 45, odds: [1.6, undefined, 2.35] },
  { id: "cr4", sport: "cricket_odi", home: "New Zealand", away: "West Indies", offset: -9, odds: [1.55, undefined, 2.45], done: true, homeScore: 268, awayScore: 241 },
  // NHL
  { id: "nh1", sport: "icehockey_nhl", home: "Maple Leafs", away: "Canadiens", offset: 10, odds: [1.78, undefined, 2.08] },
  { id: "nh2", sport: "icehockey_nhl", home: "Rangers", away: "Bruins", offset: 24, odds: [2.05, undefined, 1.8] },
  { id: "nh3", sport: "icehockey_nhl", home: "Oilers", away: "Canucks", offset: 34, odds: [1.88, undefined, 1.95] },
  // Boxing
  { id: "bx1", sport: "boxing_boxing", home: "Usyk", away: "Fury", offset: 120, odds: [1.85, undefined, 1.95] },
  { id: "bx2", sport: "boxing_boxing", home: "Inoue", away: "Fulton", offset: 200, odds: [1.35, undefined, 3.2] },
];

const bySport = new Map<string, FixtureDef[]>();
for (const fix of FIXTURES) {
  const list = bySport.get(fix.sport) ?? [];
  list.push(fix);
  bySport.set(fix.sport, list);
}

const NO_SPREAD_SPORTS = new Set(["soccer_zambia", "soccer_epl", "tennis_atp", "boxing_boxing"]);

export function demoSports() {
  return DEMO_SPORTS;
}

export function demoOdds(sportKey: string) {
  const fixtures = (bySport.get(sportKey) ?? bySport.get("soccer_zambia") ?? []).sort(
    (a, b) => a.offset - b.offset
  );
  const sportTitle =
    DEMO_SPORTS.find((s) => s.key === sportKey)?.title ?? (sportKey === "upcoming" ? "All Sports" : sportKey);

  return fixtures.slice(0, 8).map((fix) => {
    const [homeOdds, drawOdds, awayOdds] = fix.odds;
    const away = awayOdds ?? 2.0;
    const markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[] = [];

    const h2h: { name: string; price: number }[] = [{ name: fix.home, price: homeOdds }];
    if (drawOdds !== undefined) h2h.push({ name: "Draw", price: drawOdds });
    h2h.push({ name: fix.away, price: away });
    markets.push({ key: "h2h", outcomes: h2h });

    if (!NO_SPREAD_SPORTS.has(fix.sport)) {
      const spread = Math.abs(homeOdds - away) > 0.4 ? 2.5 : 1.5;
      markets.push({
        key: "spreads",
        outcomes: [
          { name: fix.home, price: 1.91, point: -spread },
          { name: fix.away, price: 1.91, point: spread },
        ],
      });
      const totalPoint = Math.round((fix.homeScore ?? 3) + (fix.awayScore ?? 2) + 1.5);
      markets.push({
        key: "totals",
        outcomes: [
          { name: "Over", price: 1.9, point: totalPoint },
          { name: "Under", price: 1.9, point: totalPoint },
        ],
      });
    }

    const hasScores = fix.homeScore !== undefined && fix.awayScore !== undefined;
    return {
      id: fix.id,
      sport_key: sportKey,
      sport_title: sportTitle,
      commence_time: iso(fix.offset),
      home_team: fix.home,
      away_team: fix.away,
      completed: fix.done,
      scores: hasScores
        ? [
            { name: fix.home, score: String(fix.homeScore) },
            { name: fix.away, score: String(fix.awayScore) },
          ]
        : null,
      bookmakers: [{ key: "demo_house", title: "Demo House", markets }],
    };
  });
}

export function demoScores(sportKey: string) {
  const fixtures = bySport.get(sportKey) ?? [];
  return fixtures
    .filter((fix) => fix.done)
    .map((fix) => ({
      id: fix.id,
      sport_key: sportKey,
      completed: true,
      home_team: fix.home,
      away_team: fix.away,
      scores: [
        { name: fix.home, score: String(fix.homeScore) },
        { name: fix.away, score: String(fix.awayScore) },
      ],
    }));
}
