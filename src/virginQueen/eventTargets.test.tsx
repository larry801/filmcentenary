import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {EventTargetSelect} from "./components/board";
import {eventTargetOptions, eventTargetValue} from "./eventTargets";
import {setupGame, zonePorts} from "./util";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";

const context = (): Ctx => ({
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("event target options", () => {
    it("lists every empty English space for Edmund Campion (#107)", () => {
        const G = game();
        const options = eventTargetOptions(G, "vq-107", "spain");
        expect(options.length).toBeGreaterThan(0);
        expect(options.every((option) => option.value !== "" &&
            G.spaces[option.value] !== undefined && SPACES.find((space) => space.id === option.value)?.area === "england" &&
            !G.spaces[option.value].unrest)).toBe(true);
        expect(eventTargetValue(options, "not-a-space")).toBe(options[0].value);
    });

    it("lists legal North Sea ports for Dunkirk Privateers (#110) and keeps an automatic choice", () => {
        const G = game();
        const port = zonePorts("northSea").find((id) => G.spaces[id] !== undefined)!;
        G.spaces[port].control = "england";
        G.spaces[port].unrest = false;
        const options = eventTargetOptions(G, "vq-110", "spain");
        expect(options[0].value).toBe("");
        expect(options.map((option) => option.value)).toContain(port);
        expect(eventTargetValue(options, "")).toBeUndefined();
        expect(eventTargetValue(options, port)).toBe(port);
    });

    it("offers the chosen area for multi-area conversion cards (#55, #70, #108)", () => {
        const G = game();
        expect(eventTargetOptions(G, "vq-055", "protestant").map((option) => option.value))
            .toEqual(["france", "netherlands"]);
        expect(eventTargetOptions(G, "vq-070", "spain").map((option) => option.value))
            .toEqual(["england", "scotland", "netherlands", "france"]);
        expect(eventTargetOptions(G, "vq-108", "spain").map((option) => option.value))
            .toEqual(["england", "scotland"]);
    });

    it("offers tribute targets for #2 and drops any power already at war", () => {
        const G = game();
        const options = eventTargetOptions(G, "vq-002", "ottoman");
        // Venice is offered only while its diplomacy is still unresolved…
        expect(options.map((option) => option.value)).toContain("venice");
        // …and the label is the localized minor name, not a raw id.
        expect(options.find((option) => option.value === "venice")!.label).toBe("威尼斯");

        G.minorDiplomacyResolved = ["venice"];
        expect(eventTargetOptions(G, "vq-002", "ottoman").map((option) => option.value)).not.toContain("venice");
    });

    it("renders a target dropdown instead of the old free-text field", () => {
        const html = renderToStaticMarkup(<EventTargetSelect cardId="vq-107"
            options={[{value: "york", label: "约克"}]} value="york" onChange={() => undefined}/>);
        expect(html).toContain("事件目标");
        expect(html).not.toContain("事件目标（可选）");
        expect(html).toContain("约克");
    });
});
