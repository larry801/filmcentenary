import React from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import i18n from "../../../constant/i18n";
import {SetupLogCode} from "../../constant/general";
import {SPACES} from "../../mapData";
import {localizeLogLine} from "../../logText";
import {scenarioName} from "../../scenario";

export interface LogMark {
    /** Index in `log` where this turn/phase starts. */
    at: number;
    turn: number;
    phase: string;
    year?: number;
}

export interface LogPanelProps {
    log: string[];
    /** Localized name of the viewer's power, used to highlight their entries. */
    myName?: string;
    marks?: LogMark[];
    /** Optional setup messages that should be translated at render time. */
    codes?: SetupLogCode[];
    /** Selects a space on the map when its name is clicked. */
    onSelectSpace?: (id: string) => void;
    /** Number of entries shown before "show all". */
    pageSize?: number;
}

type Filter = "all" | "combat" | "diplomacy" | "religion";

const FILTERS: Filter[] = ["all", "combat", "diplomacy", "religion"];

const KEYWORDS: Record<Exclude<Filter, "all">, RegExp> = {
    combat: /battle|combat|assault|siege|besieg|dice|roll|intercept|naval|fleet|army|unit|merc|mercenar|cavalry|regular|storm|fire ?ship|withdraw|retreat|capture|sack|piracy|pirate|战斗|战役|海战|骰|围城|强攻|拦截|舰队|陆军|单位|雇佣兵|骑兵|正规军|风暴|火船|撤退|攻占|掠夺|海盗/i,
    diplomacy: /diplomac|allian|war\b|war |peace|influence|betroth|marriage|married|minor|venice|papacy|scotland|ireland|portugal|treaty|declar|外交|联盟|宣战|战争|议和|和平|影响|订婚|婚姻|结婚|小国|威尼斯|教宗|苏格兰|爱尔兰|葡萄牙|条约/i,
    religion: /religio|protestant|catholic|jesuit|preach|suppress|unrest|revolt|rebel|excommunicat|conversion|convert|huguenot|pope|papal|inquisition|宗教|新教|天主教|耶稣会|布道|镇压|动荡|叛乱|起义|绝罚|转化|胡格诺|教皇|诏书|异端/i,
};

const FILTER_LABEL: Record<Filter, string> = {
    all: "all",
    combat: "combat",
    diplomacy: "diplomacy",
    religion: "religion",
};

/** Space names (English and Chinese, longest first), so both log locales link. */
const SPACE_NAMES: {id: string; name: string}[] = [...SPACES]
    .flatMap((space) => [space.name, space.nameZh].filter((name): name is string => name !== undefined)
        .map((name) => ({id: space.id, name})))
    .sort((a, b) => b.name.length - a.name.length);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SPACE_PATTERN = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${SPACE_NAMES.map((space) => escapeRegExp(space.name)).join("|")})(?=$|[^\\p{L}\\p{N}])`, "gu");

const spaceIdByName = new Map(SPACE_NAMES.map((space) => [space.name.toLowerCase(), space.id]));

/**
 * Renders a log line, turning space names into buttons that select that space
 * on the map.  Keeps the remaining text as plain text nodes.
 */
const LogLine = ({text, onSelectSpace}: {text: string; onSelectSpace?: (id: string) => void}) => {
    if (onSelectSpace === undefined) return <>{text}</>;
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(SPACE_PATTERN)) {
        const name = match[2];
        const id = spaceIdByName.get(name.toLowerCase());
        const start = (match.index ?? 0) + match[1].length;
        if (id === undefined || match.index === undefined) continue;
        if (start > last) parts.push(text.slice(last, start));
        parts.push(<button key={`${id}-${start}`} type="button" className="vq-log-space"
                           onClick={() => onSelectSpace(id)}>{name}</button>);
        last = start + name.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
};

const groupLabel = (mark: LogMark | undefined): string | undefined => {
    if (mark === undefined) return undefined;
    const phase = (i18n.chain.vq.header.phase as unknown as Record<string, string>)[mark.phase] ?? mark.phase;
    const turn = i18n.chain.vq.header.turn;
    return `${turn} ${mark.turn}${mark.year !== undefined ? ` \u00b7 ${mark.year}` : ""} \u00b7 ${phase}`;
};

/**
 * Renders a setup line from its translation code, falling back to the stored
 * string when the code is unknown (older saves, engine-authored messages).
 */
const translateCode = (code: SetupLogCode, locale: "en" | "zh_CN", fallback: string): string => {
    const template = (i18n.chain.vq.setupLog as unknown as Record<string, string>)[code.key];
    if (template === undefined) return fallback;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(code.params)) params[key] = String(value);
    if (code.key === "scenario" && typeof code.params.id === "string") {
        params.scenario = scenarioName(code.params.id as Parameters<typeof scenarioName>[0], locale);
    }
    return Object.entries(params).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);
};

/**
 * Grouped, filterable game log.  Entries are plain strings produced by the
 * moves; `marks` (recorded by the game when a phase begins) supply the turn and
 * phase headers.  Newest entries are shown first and the list is capped until
 * the viewer asks for everything.
 */
export const LogPanel = ({
    log, myName, marks, codes, onSelectSpace, pageSize = 30,
}: LogPanelProps) => {
    i18n.use();
    const [filter, setFilter] = React.useState<Filter>("all");
    const [expanded, setExpanded] = React.useState(false);

    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const codesByIndex = new Map((codes ?? []).map((code) => [code.at, code]));
    const entries = log.map((raw, index) => {
        const code = codesByIndex.get(index);
        const text = code === undefined ? localizeLogLine(raw, vqLocale) : translateCode(code, vqLocale, raw);
        const mark = [...(marks ?? [])].reverse().find((candidate) => candidate.at <= index);
        return {text, index, mark, group: groupLabel(mark)};
    });
    const filtered = filter === "all" ? entries : entries.filter((entry) => KEYWORDS[filter].test(entry.text));
    const ordered = [...filtered].reverse();
    const visible = expanded ? ordered : ordered.slice(0, pageSize);
    const hidden = ordered.length - visible.length;

    const highlight = (entry: (typeof entries)[number]): boolean =>
        myName !== undefined && myName !== "" && entry.text.includes(myName);

    let previousGroup: string | undefined;
    return <div className="vq-log">
        <div className="vq-log-filters" role="group" aria-label={i18n.chain.vq.log.title}>
            {FILTERS.map((candidate) => <Chip key={candidate} size="small" clickable
                variant={filter === candidate ? "filled" : "outlined"}
                color={filter === candidate ? "primary" : "default"}
                label={(i18n.chain.vq.log as unknown as Record<string, string>)[FILTER_LABEL[candidate]] ?? candidate}
                aria-pressed={filter === candidate}
                onClick={() => setFilter(candidate)}/>)}
        </div>
        <ol className="vq-log-list">
            {visible.map((entry) => {
                const showGroup = entry.group !== undefined && entry.group !== previousGroup;
                previousGroup = entry.group;
                return <React.Fragment key={`${entry.index}-${entry.text.slice(0, 12)}`}>
                    {showGroup && <li className="vq-log-group" aria-hidden="true">{entry.group}</li>}
                    <li className={`vq-log-line${highlight(entry) ? " vq-log-mine" : ""}`}>
                        <LogLine text={entry.text} onSelectSpace={onSelectSpace}/>
                    </li>
                </React.Fragment>;
            })}
        </ol>
        {ordered.length === 0 && <span className="vq-log-empty">{i18n.chain.vq.intel.none}</span>}
        {hidden > 0 && <Button size="small" onClick={() => setExpanded(true)}>
            {i18n.chain.vq.log.showAll} ({hidden})
        </Button>}
        {expanded && ordered.length > pageSize && <Button size="small" onClick={() => setExpanded(false)}>
            {i18n.chain.vq.log.collapse}
        </Button>}
    </div>;
};
