/**
 * The sequence of play, as the track strip's stepper shows it.
 *
 * The campaign turn is Prep → Diplomacy → Action → End (2.1).  A limited war
 * replaces the Action step with its own `war.status` ladder (13.x), and the
 * Great War replaces the campaign turn with Planning → Maneuver → Winter
 * (27.x).  Each step names the printed reference anchor it opens, so the
 * stepper is also the fastest way into the rulebook.
 *
 * The module is pure: no React, no game state, so the ordering can be tested
 * against the engine's own tables (`endPhaseOrder`).
 */
import {endPhaseOrder} from "../engine/economy";
import type {ImperialElegyState} from "../types";

export type PhaseStepKind = "phase" | "war" | "gw" | "endStep" | "outbreak";

export interface PhaseStep {
  /** Stable key: `prep`, `action`, `war:maneuver`, `gw:planning`, `end:20.5`, … */
  key: string;
  kind: PhaseStepKind;
  /** English label. */
  title: string;
  /** Chinese label. */
  titleZh: string;
  /** Reference anchor opened by clicking the step (`chart:<id>`, `rules:<x>`). */
  anchor: string;
  /** Rule number printed with the step, when the rules name one. */
  rule?: string;
  /** True for the step the game is in now. */
  current?: boolean;
  /** A step the board can advance to; absent when it only opens the reference. */
  action?: {testId: string; label: string};
}

/**
 * The campaign's own four steps (2.1), in printed order.
 *
 * Each rule number is the section the rulebook prints for that phase, not the
 * first sub-rule inside it: 10.0 Prep, 11.0 Diplomacy, 12.0 Action, 20.0 End.
 */
const CAMPAIGN_STEPS: Record<"prep" | "diplomacy" | "action" | "end", {title: string; titleZh: string; rule: string}> = {
  prep: {title: "Prep", titleZh: "准备", rule: "10.0"},
  diplomacy: {title: "Diplomacy", titleZh: "外交", rule: "11.0"},
  action: {title: "Action", titleZh: "行动", rule: "12.0"},
  end: {title: "End", titleZh: "结束", rule: "20.0"},
};

/** A limited war's `war.status` ladder (12.17.2), in printed order. */
export const WAR_STEPS: readonly {status: string; title: string; titleZh: string; rule: string}[] = [
  {status: "warAim", title: "War aim", titleZh: "战争目标", rule: "13.0"},
  {status: "alliance", title: "Alliances", titleZh: "同盟", rule: "14.0"},
  {status: "shift", title: "Alliance shift", titleZh: "同盟转换", rule: "14.2"},
  {status: "initiative", title: "Initiative", titleZh: "先手", rule: "14.3"},
  {status: "maneuver", title: "Maneuver", titleZh: "机动", rule: "15.0"},
  {status: "victory", title: "Victory & treaty", titleZh: "胜利与条约", rule: "16.0"},
  {status: "demobilization", title: "Demobilization", titleZh: "复员", rule: "17.0"},
];

/** The Great War ladder (24.1). */
export const GW_STEPS: readonly {phase: string; title: string; titleZh: string; rule: string}[] = [
  {phase: "gwPlanning", title: "Planning", titleZh: "计划", rule: "26.0"},
  {phase: "gwManeuver", title: "Maneuver", titleZh: "机动", rule: "27.0"},
  {phase: "gwWinter", title: "Winter", titleZh: "冬季", rule: "29.0"},
];

const warAnchor = (status: string): string => {
  switch (status) {
    case "initiative": return "rules:initiative";
    case "maneuver": return "rules:maneuver";
    case "victory": return "rules:victory";
    default: return "chart:war-aims-minors";
  }
};

/**
 * Every step of the current sequence, with the current one flagged.
 *
 * `G` only needs the fields the sequence depends on, so a test or a story can
 * pass a partial state.
 */
export const phaseSteps = (G: Partial<ImperialElegyState>): PhaseStep[] => {
  const phase = G.phase ?? "prep";
  const war = G.war ?? null;
  const gw = G.gw ?? null;

  if (phase === "gameOver") {
    return [{key: "gameOver", kind: "phase", title: "Game over", titleZh: "游戏结束", anchor: "rules:victory", current: true}];
  }

  if (phase === "gwOutbreak") {
    // 25.0: the outbreak happens before the Great War's own ladder.
    const steps: PhaseStep[] = [
      {key: "outbreak", kind: "outbreak", title: "Outbreak", titleZh: "爆发", anchor: "chart:crisis", rule: "25.0", current: true},
      ...gwSteps(phase, gw),
    ];
    return steps;
  }

  if (phase === "gwPlanning" || phase === "gwManeuver" || phase === "gwWinter") {
    return gwSteps(phase, gw);
  }

  const steps: PhaseStep[] = [];
  const phaseStep = (key: "prep" | "diplomacy" | "action" | "end", active: boolean, anchor?: string, titleOverride?: {title: string; titleZh: string}): PhaseStep => ({
    key,
    kind: "phase",
    title: titleOverride?.title ?? CAMPAIGN_STEPS[key].title,
    titleZh: titleOverride?.titleZh ?? CAMPAIGN_STEPS[key].titleZh,
    anchor: anchor ?? `rules:${key}`,
    rule: CAMPAIGN_STEPS[key].rule,
    current: active,
  });

  steps.push(phaseStep("prep", phase === "prep"));
  steps.push(phaseStep("diplomacy", phase === "diplomacy"));
  const currentIndex = {prep: 0, diplomacy: 1, action: 2, end: 3} as const;
  const at = currentIndex[phase as keyof typeof currentIndex] ?? 0;

  if (phase === "wartime" && war) {
    const warSteps = WAR_STEPS.map((step): PhaseStep => ({
      key: `war:${step.status}`,
      kind: "war",
      title: step.title,
      titleZh: step.titleZh,
      anchor: warAnchor(step.status),
      rule: step.rule,
      current: war.status === step.status,
    }));
    // The war ladder stands in for the Action step; keep it in that slot.
    steps.push(...warSteps);
  } else {
    steps.push(phaseStep("action", phase === "action"));
    steps.push(phaseStep("end", phase === "end"));
    if (phase === "end") {
      const cursor = G.endPhase?.step;
      const end = endPhaseOrder();
      const currentIndex = typeof cursor === "number" ? Math.min(cursor, end.length - 1) : 0;
      void at;
      return [
        ...steps.map((step) => ({...step, current: false})),
        ...end.map((entry, index): PhaseStep => ({
          key: `end:${entry.rule}`,
          kind: "endStep",
          title: entry.title,
          titleZh: entry.titleZh,
          anchor: "chart:sequence-of-play",
          rule: entry.rule,
          current: index === currentIndex,
        })),
      ];
    }
  }
  return steps;
};

const gwSteps = (phase: string, gw: ImperialElegyState["gw"] | null): PhaseStep[] => {
  void gw;
  return GW_STEPS.map((step): PhaseStep => ({
    key: `gw:${step.phase === "gwManeuver" ? "maneuver" : step.phase.replace("gw", "").toLowerCase()}`,
    kind: "gw",
    title: step.title,
    titleZh: step.titleZh,
    anchor: `chart:sequence-of-play`,
    rule: step.rule,
    current: phase === step.phase,
  }));
};

/**
 * The next thing the player may press, as a step the strip can render: the
 * board's own phase button when there is one (pass, ready, continue), the
 * war's next step when a war status has a button, and otherwise nothing.
 */
export const nextStepAction = (
  G: Partial<ImperialElegyState>,
  phaseActions: readonly {key: string; label: string; testId?: string}[],
): {testId: string; label: string} | null => {
  const current = phaseSteps(G).find((step) => step.current);
  if (current?.kind === "war") {
    // 14.3 / 15.0 / 17.0 each have their own button; the Action tab owns them.
    return null;
  }
  const button = phaseActions.find((action) => action.testId !== undefined);
  return button?.testId === undefined ? null : {testId: button.testId, label: button.label};
};

/** The reference anchor for a phase, used by the "?" control and the stepper. */
export const phaseAnchor = (G: Partial<ImperialElegyState>): string => {
  const step = phaseSteps(G).find((candidate) => candidate.current);
  return step?.anchor ?? "chart:sequence-of-play";
};
