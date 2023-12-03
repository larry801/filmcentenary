import {Country, IEra} from "./general";

export enum SongCardID {
    S01,
    S02,
    S03,
    S04,
    S05,
    S06,
    S07,
    S08,
    S09,
    S10,
    S11,
    S12,
    S13,
    S14,
    S15,
    S16,
    S17,
    S18,
    S19,
    S20,
    S21,
    S22,
    S23,
    S24,
    S25,
    S26,
    S27,
    S28,
    S29,
    S30,
    S31,
    S32,
    S33,
    S34,
    S35,
    S36,
    S37,
    S38,
    S39,
    S40,
    S41,
    S42,
    S43,
    S44,
    S45,
    S46,
    S47,
    S48,
    S49,
    S50
}

export enum JinnCardID {
    J01,
    J02,
    J03,
    J04,
    J05,
    J06,
    J07,
    J08,
    J09,
    J10,
    J11,
    J12,
    J13,
    J14,
    J15,
    J16,
    J17,
    J18,
    J19,
    J20,
    J21,
    J22,
    J23,
    J24,
    J25,
    J26,
    J27,
    J28,
    J29,
    J30,
    J31,
    J32,
    J33,
    J34,
    J35,
    J36,
    J37,
    J38,
    J39,
    J40,
    J41,
    J42,
    J43,
    J44,
    J45,
    J46,
    J47,
    J48,
    J49,
    J50
}

export enum OptionalJinnCardID {
    X01,
    X02,
    X03,
    X04,
    X05,
    X06,
    X07
}

export enum OptionalSongCardID {
    X08,
    X09,
    X10,
    X11,
    X12
}

type CardID = SongCardID | JinnCardID | OptionalSongCardID | OptionalJinnCardID;

export enum EventDuration {
    INSTANT = "INSTANT",
    CONTINUOUS = "CONTINUOUS"
}

export const getFullDesc = (card: Cards): string => {
    let effText = "效果：" + card.effectText;
    if (card.ban !== null) {
        effText += `撤销：${card.ban}`
    }

    return effText;
}

export interface Cards {
    id: CardID,
    block: string | null
    name: string,
    country: Country,
    op: 1 | 2 | 3 | 4,
    once: boolean,
    era: IEra,
    remove: boolean,
    duration: EventDuration,
    effectText: string,
    ban: string | null
}

export const SongEarly: Cards[] = [
    {
        id: 1,
        name: "建炎南渡",
        op: 4,
        country: "宋",
        era: "早期",
        remove: false,
        duration: "持续",
        precondition: "宋国未控制开封",
        combat: false,
        effectText: "在两浙路或江南两路免费拥立。宋国获得1国力禁止金国以事件方式在两浙路放置部队。",
        unlock: "【苗刘兵变】",
        block: null,
        ban: null
    }
]