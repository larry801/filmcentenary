import {PatronageVpAward} from "./types";

/** Individual VP award markers transcribed from the VASSAL 4.6 module. */
export const PATRONAGE_VP_AWARDS: PatronageVpAward[] = [
    {id: "fatherModernScience", nameEn: "Father of Modern Science", kind: "scientist", vp: 2},
    {id: "lawsPlanetaryMotion", nameEn: "Laws of Planetary Motion", kind: "scientist", vp: 2},
    {id: "earlyAtlas", nameEn: "Early Atlas", kind: "scientist", vp: 1},
    {id: "mirrorOfCountries", nameEn: "Mirror of Countries", kind: "scientist", vp: 1},
    {id: "onTheMagnet", nameEn: "On the Magnet", kind: "scientist", vp: 1},
    {id: "academyMilitaryArchitecture", nameEn: "Academy of Military Architecture", kind: "scientist", vp: 1},
    {id: "romeoAndJuliet", nameEn: "Romeo and Juliet", kind: "artist", vp: 3, artistType: "writer"},
    {id: "donQuixote", nameEn: "Don Quixote", kind: "artist", vp: 3, artistType: "writer"},
    {id: "suleimaniyeMosque", nameEn: "Suleimaniye Mosque", kind: "artist", vp: 3, artistType: "architect"},
    {id: "elEscorial", nameEn: "El Escorial", kind: "artist", vp: 2, artistType: "architect"},
    {id: "burialOfCountOrgaz", nameEn: "Burial of Count Orgaz", kind: "artist", vp: 2, artistType: "painter"},
    {id: "fightBetweenCarnivalAndLent", nameEn: "Fight between Carnival and Lent", kind: "artist", vp: 2, artistType: "painter"},
    {id: "dianaAndActaeon", nameEn: "Diana and Actaeon", kind: "artist", vp: 2, artistType: "painter"},
    {id: "vertumnus", nameEn: "Vertumnus", kind: "artist", vp: 1},
    {id: "lesAmours", nameEn: "Les Amours", kind: "artist", vp: 1},
    {id: "elegyForSuleiman", nameEn: "Elegy for Suleiman", kind: "artist", vp: 1},
    {id: "louvreRenovations", nameEn: "Louvre Renovations", kind: "artist", vp: 1},
    {id: "fourBooksOfArchitecture", nameEn: "Four Books of Architecture", kind: "artist", vp: 1},
    {id: "portraitOfElisabethOfAustria", nameEn: "Portrait of Elisabeth of Austria", kind: "artist", vp: 1},
];

export const PATRONAGE_VP_AWARD_BY_ID: Record<string, PatronageVpAward> = Object.fromEntries(
    PATRONAGE_VP_AWARDS.map((award) => [award.id, award]),
);

export const CAMPAIGN_VP_AWARDS = PATRONAGE_VP_AWARDS.map((award) => award.id);
export const TOURNAMENT_UNAVAILABLE_VP_AWARDS = [
    "fightBetweenCarnivalAndLent",
    "elegyForSuleiman",
];
export const TOURNAMENT_VP_AWARDS = CAMPAIGN_VP_AWARDS.filter(
    (id) => !TOURNAMENT_UNAVAILABLE_VP_AWARDS.includes(id),
);
