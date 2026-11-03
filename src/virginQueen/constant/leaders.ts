import {LeaderDef, POWERS, Power} from "./general";

/**
 * Leaders with approximate ratings. The printed counters are not part of the
 * rules PDF, so battle / command / piracy values are a historical
 * reconstruction balanced for this implementation.
 */
export const LEADERS: LeaderDef[] = [
    // Ottoman
    {id: "lalaMustafa", name: "Lala Mustafa Pasha", power: "ottoman", kind: "army", battle: 2, command: 6, start: "istanbul"},
    {id: "sinanPasha", name: "Sinan Pasha", power: "ottoman", kind: "army", battle: 2, command: 7, start: "buda"},
    {id: "piyale", name: "Piyale Pasha", power: "ottoman", kind: "naval", battle: 2, start: "istanbul"},
    {id: "dragut", name: "Dragut", power: "ottoman", kind: "naval", battle: 3, piracy: 2, start: "algiers"},
    {id: "uluchAli", name: "Uluch Ali", power: "ottoman", kind: "naval", battle: 3, piracy: 2, start: "pool"},

    // Spain
    {id: "alba", name: "Duke of Alba", power: "spain", kind: "army", battle: 3, command: 8, start: "brussels"},
    {id: "parma", name: "Duke of Parma", power: "spain", kind: "army", battle: 3, command: 8, start: "milan"},
    {id: "donJohn", name: "Don John of Austria", power: "spain", kind: "army", battle: 3, command: 6, start: "madrid"},
    {id: "santaCruz", name: "Marquis of Santa Cruz", power: "spain", kind: "naval", battle: 3, start: "seville"},
    {id: "medinaSidonia", name: "Duke of Medina Sidonia", power: "spain", kind: "naval", battle: 1, start: "corunna"},

    // England
    {id: "leicester", name: "Earl of Leicester", power: "england", kind: "army", battle: 2, command: 6, start: "london"},
    {id: "howard", name: "Lord Howard of Effingham", power: "england", kind: "naval", battle: 2, start: "london"},
    {id: "drake", name: "Francis Drake", power: "england", kind: "naval", battle: 4, piracy: 2, start: "plymouth"},
    {id: "hawkins", name: "John Hawkins", power: "england", kind: "naval", battle: 3, piracy: 1, start: "portsmouth"},

    // France
    {id: "guise", name: "Duke of Guise", power: "france", kind: "army", battle: 3, command: 6, start: "paris"},
    {id: "montmorency", name: "Anne de Montmorency", power: "france", kind: "army", battle: 2, command: 7, start: "lyon"},
    {id: "henryIII", name: "Henry III", power: "france", kind: "army", battle: 2, command: 6, start: "paris"},
    {id: "joyeuse", name: "Duke of Joyeuse", power: "france", kind: "army", battle: 1, command: 4, start: "bordeaux"},

    // Holy Roman Empire
    {id: "schwendi", name: "Lazarus von Schwendi", power: "hre", kind: "army", battle: 2, command: 8, start: "vienna"},
    {id: "zrinyi", name: "Nikola Zrinyi", power: "hre", kind: "army", battle: 2, command: 6, start: "pressburg"},
    {id: "mansfeld", name: "Count of Mansfeld", power: "hre", kind: "army", battle: 2, command: 5, start: "prague"},

    // Protestant
    {id: "coligny", name: "Gaspard de Coligny", power: "protestant", kind: "army", battle: 3, command: 6, start: "laRochelle"},
    {id: "navarre", name: "Henry of Navarre", power: "protestant", kind: "army", battle: 3, command: 8, start: "bearn"},
    {id: "orange", name: "William of Orange", power: "protestant", kind: "army", battle: 2, command: 6, start: "pool"},
    {id: "maurice", name: "Maurice of Nassau", power: "protestant", kind: "army", battle: 3, command: 8, start: "pool"},
];

export const LEADER_BY_ID: Record<string, LeaderDef> = Object.fromEntries(
    LEADERS.map((l) => [l.id, l]),
);

export const leadersOf = (p: Power): LeaderDef[] => LEADERS.filter((l) => l.power === p);

export const startingLeaders: Record<Power, string[]> = Object.fromEntries(
    POWERS.map((p) => [p, leadersOf(p).filter((l) => l.start !== "pool").map((l) => l.id)]),
) as Record<Power, string[]>;
