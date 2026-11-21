/**
 * The selected space, split into the two questions a player asks about it.
 *
 * The Orders panel used to be one long column holding both answers, so a
 * twelve-row action list pushed the space's own facts off screen and the facts
 * pushed the only two legal actions below the fold.  The two halves are now
 * separate components and separate pages of the Orders panel:
 *
 *   SpaceDetailPanel   what this space *is* (control, markers, units, supply)
 *   SpaceActionsPanel  what this seat may *do* here, right now
 *
 * `SpacePanel` composes them in that order for the suites that render the panel
 * on its own; the board mounts them on their own pages instead.
 *
 * The action list keeps a single render of every row.  Before, the legal rows
 * were printed twice — once in an "available now" shortcut strip and again
 * inside their group — which doubled the panel's height for no new
 * information.  Now the legal rows *are* the strip and the refused rows fold
 * into one collapsible section that still carries each printed reason.
 */
import React from "react";
import {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, neighboursOf, spaceLabel} from "../constant/spaces";
import {effectiveKeyType, gwAllyImpulseFor, hasLoc} from "../engine/rules";
import {polishReserveDeployer} from "../engine/poland";
import {IEPanel} from "./theme";
import {RuleLink} from "./RuleRef";
import {ieT} from "./i18n";
import {bi, controlLabel, unitIsCommanded, unitLabel} from "./boardHelpers";
import {ACTION_GROUP_LABELS, ACTION_GROUP_ORDER, type ActionGroupId, type SpaceAction} from "./actionAvailability";
import {readShowUnavailable, writeShowUnavailable} from "./preferences";
import {useSpaceActions} from "./spaceActionModel";

/** What both halves need: the selection, the seat, the phase. */
interface SpaceBaseProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  phase: string;
  canAct: boolean;
}

// ---------------------------------------------------------------------------
// Space details (read + unit selection)
// ---------------------------------------------------------------------------

export interface SpaceUnitPickerProps extends SpaceBaseProps {
  selectedUnit: string | null;
  setSelectedUnit: (id: string | null) => void;
  /**
   * Namespace for the picker's test ids.
   *
   * The same picker is printed twice while the turn panel is open — on the
   * Orders page and in the War tab's move console — and both bodies stay
   * mounted (inactive ones are only `hidden`).  A prefix keeps each copy
   * addressable: `ie-war-unit-…` in the War tab, `ie-unit-…` on the Orders page.
   */
  testIdPrefix?: string;
  /** Every unit of the current selection, primary first (12.15/16.1 stacks). */
  selectedUnitIds?: string[];
  /** Add or remove one unit from the current selection (the stack form). */
  toggleUnitSelection?: (id: string) => void;
  /**
   * Replace the selection with a whole stack in one dispatch.  A loop of
   * `toggleUnitSelection` cannot build a group: React batches the dispatches
   * and each reducer call still sees the pre-batch state.
   */
  selectUnitGroup?: (ids: string[]) => void;
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  /** Runs a move; `describe` lets the board explain a refusal. */
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export interface SpaceDetailPanelProps extends SpaceBaseProps {
  /** The selection, so the read-only chips can mark which units are chosen. */
  selectedUnitIds?: string[];
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  /** Runs a move; `describe` lets the board explain a refusal. */
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const SpaceDetailPanel = (props: SpaceDetailPanelProps) => {
  const {
    G, selected, viewer, me, locale, t,
    selectedUnitIds = [], pending, canDecide, doAction, moves,
  } = props;

  const selectedSpace = selected ? SPACES[selected] : null;
  const selectedState = selected ? G.spaces[selected] : null;

  return (
    <IEPanel className="ie-space-detail-panel" title={t.spaceDetail}>
      {!selectedSpace || !selectedState ? <div className="ie-muted">{t.noSpace}</div> : (
        <div className="ie-space-detail" data-testid="ie-space-detail">
          <h4>{locale === "zh_CN" ? selectedSpace.nameZh : selectedSpace.name} <span className="ie-muted">({selectedSpace.type})</span></h4>
          <div>
            <strong>{t.control}:</strong> {controlLabel(t, selectedState.control)} · <strong>{t.influence}:</strong> {controlLabel(t, selectedState.influence ?? null)} · <strong>{t.diplomacy}:</strong> {controlLabel(t, selectedState.diplomacy ?? null)} · <strong>{t.ally}:</strong> {controlLabel(t, selectedState.ally ?? null)}
          </div>
          <div>
            <strong>{t.fort}:</strong> {selectedState.fort ? `${selectedState.fort.level} (${selectedState.fort.power})` : "—"} · <strong>{t.pacification}:</strong> {selectedState.pacification ?? 0} · <strong>{t.rebellion}:</strong> {selectedState.rebellion ? `${selectedState.rebellion.minor} (${selectedState.rebellion.step})` : "—"}
          </div>
          {selectedSpace.ports?.length ? <div><strong>{t.ports}:</strong> {selectedSpace.ports.map((p) => spaceLabel(p, locale)).join(", ")}</div> : null}
          {effectiveKeyType(G, selected!) !== undefined && (
            <div data-testid="ie-space-key-type">
              <strong>{t.keyType}:</strong>{" "}
              {effectiveKeyType(G, selected!) === "colonial" ? t.keyTypeColonial : t.keyTypeTerritorial}
              {selectedState.keyTypeOverride !== undefined && selectedState.keyTypeOverride !== selectedSpace.keyType
                ? ` (${bi(locale, "changed in play", "游戏中变更")})`
                : ""}
            </div>
          )}
          <div><strong>{t.connections}:</strong> {neighboursOf(selected!).map((id) => spaceLabel(id, locale)).join(", ")}</div>
          {viewer && me && <div><strong>{t.supply}:</strong> {hasLoc(G, viewer, selected!) ? t.inSupply : t.outOfSupply}</div>}
          {/* Read-only: choosing a unit is how an action starts, so the buttons
              live on the Actions page.  The Space page answers "what is here",
              and says which of these chips are in the current selection. */}
          <div className="ie-space-units" data-testid="ie-space-units">
            <strong>{t.units}:</strong> {selectedState.units.length === 0 ? "—" : selectedState.units.map((id) => {
              const u = G.units[id];
              if (!u) return null;
              const isPendingUnit = canDecide && pending !== null && pending.options.some((o) => o.id === id);
              const selectedHere = selectedUnitIds.includes(id);
              return (
                <span
                  key={id}
                  className={`ie-unit-chip${isPendingUnit ? " pending" : ""}${selectedHere ? " selected" : ""}`}
                  data-testid={`ie-space-unit-${id}`}
                  aria-current={selectedHere ? "true" : undefined}
                >
                  {unitLabel(u, t, locale)}
                </span>
              );
            })}</div>
        </div>
      )}
    </IEPanel>
  );
};

/**
 * The unit buttons: the first click of most actions.
 *
 * They sit on the Actions page rather than the Space page because selecting a
 * unit is not reading — it arms the map's rings — so it must not cost a page
 * switch.  The Space page prints the same units as read-only chips.
 */
export const SpaceUnitPicker = (props: SpaceUnitPickerProps) => {
  const {
    G, selected, viewer, locale, t, phase, canAct,
    selectedUnit, setSelectedUnit, selectedUnitIds = [], toggleUnitSelection, selectUnitGroup,
    pending, canDecide, doAction, moves,
    testIdPrefix = "ie-",
  } = props;
  /** `ie-unit-…` on the Orders page, `ie-war-unit-…` in the War tab's copy. */
  const tid = (name: string): string => `${testIdPrefix}${name}`;

  const selectedState = selected ? G.spaces[selected] : null;
  if (selectedState === null) return null;
  const commandedOwner = viewer === null ? null : gwAllyImpulseFor(G, viewer) ?? viewer;
  const commanded = (unit: Unit): boolean => unitIsCommanded(G, viewer, unit, phase);

  const ownUnits = selectedState.units
    .map((id) => G.units[id])
    .filter((u): u is Unit => u !== undefined && viewer !== null && commanded(u));
  if (ownUnits.length === 0) return null;

  // A 15.4 controlled minor fights with its controller, but the limited war's
  // 12.15/16.1 move actions still accept the seat's own counters only.
  // Keeping them out of the stack shortcut stops "move all" from silently
  // leaving the minor behind; the Great War ladder commands them (27.5).
  const moveCapable = (unit: Unit): boolean =>
    phase === "gwManeuver" || unit.owner === commandedOwner;
  const movable = ownUnits.filter((u) => !(u.flags?.deployedThisImpulse === true) && moveCapable(u));
  const allSelected = movable.length > 0 && movable.every((u) => selectedUnitIds.includes(u.id));

  return (
    <div className="ie-unit-picker" data-testid={tid("unit-picker")}>
      <div className="ie-space-units">
        <strong>{t.units}:</strong>
        {selectedState.units.map((id) => {
          const u = G.units[id];
          if (!u) return null;
          const mine = viewer !== null && commanded(u);
          const isPendingUnit = canDecide && pending !== null && pending.options.some((o) => o.id === id);
          if (!mine) return <span key={id} className={`ie-unit-chip${isPendingUnit ? " pending" : ""}`}>{unitLabel(u, t, locale)}</span>;
          if (isPendingUnit) return <button key={id} className="ie-btn secondary selected" aria-pressed onClick={() => doAction(() => moves.resolvePending(id), {label: unitLabel(u, t, locale)})}>{unitLabel(u, t, locale)}</button>;
          const selectedHere = selectedUnitIds.includes(id);
          // Clicking toggles the unit in the selection instead of replacing it,
          // so several units of one space can move as a single action (12.15
          // land stacks, 16.1 fleets).  A single click still behaves exactly as
          // before when nothing else is selected.
          const onClick = toggleUnitSelection !== undefined
            ? () => (selectedUnit === id && selectedUnitIds.length === 1 ? setSelectedUnit(null) : toggleUnitSelection(id))
            : () => setSelectedUnit(id);
          return <button key={id} data-testid={tid(`unit-${id}`)} className="ie-btn secondary" aria-pressed={selectedHere} onClick={onClick}>{unitLabel(u, t, locale)}</button>;
        })}
      </div>
      {/*
        * A whole-stack shortcut.  Both rules that move several units at once
        * (12.15 redeployment, 16.1 naval movement) move "all" of them, so
        * selecting each one by hand is busywork; the button selects every
        * commanded unit in the space that can actually leave.
        */}
      {canAct && movable.length > 1 && (
        <div className="ie-space-select-all">
          <button
            type="button"
            className="ie-btn secondary ie-mini"
            data-testid={tid("select-stack")}
            data-all-selected={allSelected ? "true" : "false"}
            onClick={() => {
              if (allSelected) { setSelectedUnit(null); return; }
              // One dispatch, not "select the first then toggle the rest":
              // React batches these, so a second dispatch would still read the
              // pre-batch state and drop the first unit.
              selectUnitGroup?.(movable.map((unit) => unit.id));
            }}
          >
            {allSelected
              ? bi(locale, "Clear selection", "取消选择")
              : bi(locale, `Select all ${movable.length} units`, `全选 ${movable.length} 个单位`)}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Space actions (the write side)
// ---------------------------------------------------------------------------

export interface SpaceActionsPanelProps extends SpaceBaseProps {
  /** Opens the reference drawer (the "?" next to the action list). */
  onOpenReference?: (anchor: string) => void;
  /** The rows `useSpaceActions` computed for this selection. */
  rows: SpaceAction[];
  /**
   * The live "show unavailable" preference.  Omitted means "read the stored one
   * on mount", which is what the panel suites rely on; the board passes its own
   * state so the Display menu's switch takes effect without a reload.
   */
  showUnavailable?: boolean;
  setShowUnavailable?: (open: boolean) => void;
  cpRemaining: number;
  /** 22.5(2): the deploy-reserves row's Polish-reserve modifier. */
  polishReserve: boolean;
  setPolishReserve: (b: boolean) => void;
  selectedUnitDef: Unit | undefined;
  setSelectedUnit: (id: string | null) => void;
  battleFrom: SpaceId | null;
  setBattleFrom: (id: SpaceId | null) => void;
  navalFrom: SpaceId | null;
  setNavalFrom: (id: SpaceId | null) => void;
  /**
   * Render only the rows this predicate accepts.
   *
   * The War tab prints the movement half of this same list (the "Move & battle"
   * group) so a wartime player does not have to switch to the Orders page to
   * march, rail, sail or fight.  One renderer keeps the labels, costs and printed
   * reasons identical to the Orders page; only the subset differs.
   */
  rowFilter?: (row: SpaceAction) => boolean;
  /**
   * Namespace for every test id inside the panel.
   *
   * Both panel bodies stay mounted while the turn panel is open, so the War
   * tab's copy must not collide with the Orders page's addresses.
   */
  testIdPrefix?: string;
  /** Print the space's name, the page hint and the cost link (default true). */
  showHead?: boolean;
}

/**
 * The historic test ids for rows that used to be their own buttons.  The e2e
 * specs, the bot suites and the control tests address these names, so a row
 * keeps the name of the button it replaced.
 */
const LEGACY_ACTION_IDS: Partial<Record<SpaceAction["id"], string>> = {
  gwMarch: "ie-gw-march",
  gwRail: "ie-gw-rail",
  gwDeploy: "ie-gw-deploy-action",
  gwElite: "ie-gw-elite-corps",
  gwNaval: "ie-gw-naval",
  refit: "ie-gw-refit",
  refitFleet: "ie-refit-fleet",
  deployReserves: "ie-deploy-reserves",
};

/** The space's name and control, always on screen above the action list. */
const ActionsHeading = ({G, selected, locale, t, testIdPrefix = "ie-"}: Pick<SpaceBaseProps, "G" | "selected" | "locale" | "t"> & {testIdPrefix?: string}) => {
  const space = selected ? SPACES[selected] : null;
  const state = selected ? G.spaces[selected] : null;
  if (!space || !state) return <div className="ie-muted" data-testid={`${testIdPrefix}actions-space`}>{t.noSpace}</div>;
  return (
    <div className="ie-actions-space" data-testid={`${testIdPrefix}actions-space`}>
      <b>{locale === "zh_CN" ? space.nameZh : space.name}</b>
      <span className="ie-muted"> · {t.control}: {controlLabel(t, state.control)}</span>
    </div>
  );
};

export const SpaceActionsPanel = (props: SpaceActionsPanelProps) => {
  const {
    G, selected, viewer, locale, t, canAct, onOpenReference,
    rows: allRows, cpRemaining,
    polishReserve, setPolishReserve, selectedUnitDef, setSelectedUnit,
    battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    rowFilter, testIdPrefix = "ie-", showHead = true,
    showUnavailable: liveShowUnavailable, setShowUnavailable: setLiveShowUnavailable,
  } = props;
  const rows = rowFilter === undefined ? allRows : allRows.filter(rowFilter);

  /**
   * The fold state is remembered per browser (`ie_show_unavailable`): a reader
   * who studies the printed restrictions once keeps them open, and everyone
   * else gets the legal rows without a scroll.  The board supplies the live
   * value so the Display menu's switch applies without a reload; on its own the
   * panel reads storage once, like the other preference-driven controls.
   */
  const [internalShow, setInternalShow] = React.useState<boolean>(() => readShowUnavailable());
  const showUnavailable = liveShowUnavailable ?? internalShow;
  const setShowUnavailable = (open: boolean) => {
    // The board owns the preference when it is connected (so the Display menu,
    // the fold and the storage key cannot drift); on its own the panel writes
    // it directly, exactly like the other preference-driven controls.
    if (setLiveShowUnavailable !== undefined) setLiveShowUnavailable(open);
    else {
      writeShowUnavailable(open);
      setInternalShow(open);
    }
  };

  /**
   * Run a row.  `spaceActions` already funnels each `run` through the board's
   * `doAction` wrapper with the row's own label and reason, so the rejection
   * notice names exactly the action the player clicked; wrapping it again here
   * would arm a second probe for the same click.
   */
  const runAction = (item: SpaceAction): void => {
    if (!item.enabled) return;
    item.run();
  };

  /**
   * One action row.  Legal and refused rows share the exact same markup: the
   * wrapper keeps the historic `ie-action-<id>` address and the `data-enabled`
   * flag, and the button keeps the name of the button it replaced (or the
   * `ie-action-now-<id>` shortcut address).  Only the placement differs — legal
   * rows in the "available now" strip, refused ones behind the fold — so a
   * selector finds the same control wherever it is rendered.
   */
  const actionRow = (item: SpaceAction) => {
    const legacy = LEGACY_ACTION_IDS[item.id];
    return (
    <div
      key={item.uid ?? item.id}
      className={`ie-action${item.enabled ? " ie-action-legal" : ""}`}
      data-testid={`${testIdPrefix}action-${item.uid ?? item.id}`}
      data-legacy-testid={legacy}
      data-enabled={item.enabled ? "true" : "false"}
    >
      <button
        type="button"
        className={item.enabled ? "ie-btn ie-btn-xs" : "ie-btn"}
        // The button keeps the name of the control it replaced (`ie-gw-march`,
        // …); a row without a historic name is addressed by its wrapper's
        // `ie-action-<id>` and, while legal, also by the strip's
        // `ie-action-now-<id>`.  The War tab's copy prefixes every id so the two
        // mounted copies never answer to the same selector.
        data-testid={legacy !== undefined
          ? `${testIdPrefix}${legacy.replace(/^ie-/, "")}`
          : (item.enabled ? `${testIdPrefix}action-now-${item.uid ?? item.id}` : undefined)}
        disabled={!item.enabled}
        title={item.reason ?? item.label}
        onClick={() => runAction(item)}
      >
        {item.label}
        {item.cost > 0 && <span className="ie-action-cost" aria-hidden="true"> · {item.cost} CP</span>}
      </button>
      {/* The reason is a block, not a title attribute: the printed restriction
          must be legible on a phone, where a tooltip needs a pointer. */}
      {!item.enabled && item.reason !== undefined && <span className="ie-action-reason">{item.reason}</span>}
    </div>
    );
  };

  /**
   * The legal rows, cheapest first.  Cost order rather than rulebook order: the
   * list exists to be clicked without reading, and a 1 CP build sits above a
   * 4 CP alliance.  Ties keep their list order so the list is stable between
   * renders.
   */
  const enabledRows: SpaceAction[] = React.useMemo(
    () => rows.filter((item) => item.enabled).sort((a, b) => a.cost - b.cost),
    [rows],
  );
  const refusedRows: SpaceAction[] = React.useMemo(
    () => rows.filter((item) => !item.enabled),
    [rows],
  );
  /** Refused rows by printed group, so the fold reads like the player aid. */
  const refusedByGroup = React.useMemo(() => {
    const out: {group: ActionGroupId; items: SpaceAction[]}[] = [];
    for (const group of ACTION_GROUP_ORDER) {
      const items = refusedRows.filter((item) => item.group === group);
      if (items.length > 0) out.push({group, items});
    }
    return out;
  }, [refusedRows]);

  /** 22.5(2): only the Polish controller carries the reserve-army modifier. */
  const polishOwner = viewer !== null && polishReserveDeployer(G) === viewer;
  const deployLegal = enabledRows.some((item) => item.id === "deployReserves");

  return (
    <section className="ie-space-actions" data-testid={`${testIdPrefix}space-actions`}>
      {showHead && <ActionsHeading G={G} selected={selected} locale={locale} t={t} testIdPrefix={testIdPrefix}/>}

      {canAct && (
        <div className="ie-action-groups" data-testid={`${testIdPrefix}action-list`}>
          {showHead && (
            <div className="ie-action-groups-head">
              <span className="ie-action-groups-hint">
                {bi(locale, "Every action the rules allow here, and why the rest are closed.", "此处规则允许的全部行动，以及其余行动不可用的原因。")}
              </span>
              {/* The player aid's cost list, rendered from ACTION_COSTS. */}
              <RuleLink anchor="rules:costs" locale={locale} onOpenReference={onOpenReference} testId={`${testIdPrefix}rule-ref-action-costs`}/>
            </div>
          )}

          {/*
            * The legal rows, and the only copy of them.  A typical space
            * refuses ten of its twelve rows, so the two that work are printed
            * first, in cost order, with no scroll and no second list below.
            */}
          {enabledRows.length > 0 ? (
            <div className="ie-action-now" data-testid={`${testIdPrefix}action-available`} data-count={enabledRows.length}>
              <span className="ie-action-now-label">
                {bi(locale, `${enabledRows.length} available now`, `${enabledRows.length} 项现在可用`)}
              </span>
              <div className="ie-actions-grid">
                {enabledRows.map(actionRow)}
              </div>
              {/* 22.5(2): the modifier belongs to the deploy row, which lives in
                  this strip while it is legal. */}
              {deployLegal && polishOwner && (
                <label className="ie-inline ie-check" data-testid={`${testIdPrefix}polish-reserve-toggle`} title={bi(locale, "22.5(2): a deploy-reserves action may also deploy one Polish reserve army.", "22.5(2)：部署预备军行动可额外部署 1 支波兰预备军。")}>
                  <input type="checkbox" checked={polishReserve} onChange={(e) => setPolishReserve(e.target.checked)} />
                  {bi(locale, "Also deploy 1 Polish reserve army", "同时部署 1 支波兰预备军")}
                </label>
              )}
            </div>
          ) : (
            <div className="ie-muted" data-testid={`${testIdPrefix}action-none`}>
              {bi(locale, "No action is legal in this space right now.", "此空间当前没有可执行的行动。")}
            </div>
          )}

          {/*
            * The refused rows, folded.  They are never dropped: a disabled row's
            * reason is how a player learns the restriction, so the section stays
            * in the DOM with every printed reason behind one summary line.
            */}
          {refusedByGroup.length > 0 && (
            <details
              className="ie-unavailable"
              data-testid={`${testIdPrefix}unavailable`}
              open={showUnavailable}
              onToggle={(event) => {
                const open = (event.currentTarget as HTMLDetailsElement).open;
                setShowUnavailable(open);
              }}
            >
              <summary className="ie-unavailable-summary" data-testid={`${testIdPrefix}unavailable-summary`}>
                {bi(locale, `Unavailable (${refusedRows.length})`, `不可用（${refusedRows.length}）`)}
              </summary>
              <div className="ie-unavailable-body">
                {refusedByGroup.map(({group, items}) => (
                  <section key={group} className="ie-action-group" data-testid={`${testIdPrefix}actions-${group}`} data-available="0">
                    <h5 className="ie-action-group-title">
                      {locale === "zh_CN" ? ACTION_GROUP_LABELS[group].zh : ACTION_GROUP_LABELS[group].en}
                      <span className="ie-action-group-badge" aria-label={bi(locale, "0 available", "0 项可用")}>0</span>
                    </h5>
                    <div className="ie-actions-grid">{items.map(actionRow)}</div>
                  </section>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {canAct && (battleFrom !== null || navalFrom !== null) && (
        <div className="ie-target-hint" data-testid={`${testIdPrefix}target-hint`}>
          <strong>{battleFrom ?? navalFrom}</strong>: {bi(locale, "choose a highlighted adjacent target space on the map.", "在地图上选择高亮的相邻目标空间。")}
          <button className="ie-btn secondary ie-mini" onClick={() => { setBattleFrom(null); setNavalFrom(null); }}>{t.cancel}</button>
        </div>
      )}

      {/* The selection echo: a unit chosen on the Space page moves from here,
          and the cost chip answers "what can I afford" at a glance now that the
          grouped heads are gone. */}
      {canAct && (selectedUnitDef !== undefined || enabledRows.length > 0) && (
        <div className="ie-action-foot" data-testid={`${testIdPrefix}action-foot`}>
          <span className="ie-action-cp-note">{bi(locale, `CP left this impulse: ${cpRemaining}`, `本行动轮剩余 CP：${cpRemaining}`)}</span>
          {selectedUnitDef !== undefined && selectedUnitDef.space === selected && (
            <span className="ie-action-selected" data-testid={`${testIdPrefix}action-selected`}>
              <span>{bi(locale, "Selected:", "已选：")}</span>
              <button className="ie-btn secondary ie-mini" onClick={() => setSelectedUnit(null)}>
                {bi(locale, "Clear unit selection", "取消单位选择")}
              </button>
            </span>
          )}
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// The composite (suites that render the panel on its own)
// ---------------------------------------------------------------------------

export interface SpacePanelProps extends SpaceBaseProps {
  /**
   * The composite's own inputs: the unit picker's selection state, and the rows'
   * engine inputs when the caller does not pass `rows`.
   */
  selectedUnit?: string | null;
  setSelectedUnit?: (id: string | null) => void;
  selectedUnitIds?: string[];
  toggleUnitSelection?: (id: string) => void;
  selectUnitGroup?: (ids: string[]) => void;
  pending?: ImperialElegyState["pending"];
  canDecide?: boolean;
  selectedUnitDef?: Unit;
  /** The board's action wrapper and move bag; the panel suites pass them too. */
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
  /** Opens the reference drawer; forwarded to the Actions half only. */
  onOpenReference?: (anchor: string) => void;
  /** The rows the board computed; omitted means "compute them here". */
  rows?: SpaceAction[];
  cpRemaining?: number;
  canSpend?: (cost: number) => boolean;
  canActionCard?: boolean;
  war?: ImperialElegyState["war"];
  polishReserve?: boolean;
  setPolishReserve?: (b: boolean) => void;
  battleFrom?: SpaceId | null;
  navalFrom?: SpaceId | null;
  /** The board holds these as refs; the suites pass plain setters. */
  setBattleFrom?: React.MutableRefObject<(id: SpaceId | null) => void> | ((id: SpaceId | null) => void);
  setNavalFrom?: React.MutableRefObject<(id: SpaceId | null) => void> | ((id: SpaceId | null) => void);
  startMoveTargeting?: () => void;
  // The inputs `spaceActions` needs when the caller does not pass `rows`.
  polishArmyDecision?: {allowed: boolean; cost: number; reasons: string[]} | null;
  polishReserveDecision?: {allowed: boolean; cost: number; reasons: string[]} | null;
  gwJointNavalAllies?: Power[];
  gwJointNavalUnitIds?: (ally: Power) => string[];
  myOnMapArmies?: number;
  myForts?: number;
  myMinorAllies?: number;
  ownLandInSelected?: Unit[];
  ownNavalInSelected?: Unit[];
  potentialLandTargets?: SpaceId[];
  potentialNavalTargets?: SpaceId[];
  deployLimit?: number;
  deployFree?: boolean;
  canDeployHere?: boolean;
  canGwDraft?: boolean;
  canGwDeployHere?: boolean;
}

/** The board passes refs, the suites pass setters: call whichever arrives. */
const invokeSetter = (
  setter: React.MutableRefObject<(id: SpaceId | null) => void> | ((id: SpaceId | null) => void) | undefined,
  id: SpaceId | null,
): void => {
  if (setter === undefined) return;
  if (typeof setter === "function") setter(id);
  else setter.current(id);
};

/**
 * Detail + actions, in that order.
 *
 * The board does not use this composition any more — the two halves are
 * separate pages of the Orders panel — but the panel suites render it as one
 * element.  It computes the rows itself when the caller does not supply them,
 * which is the contract the panel had before the split: one component, one
 * action list, no caller-side bookkeeping.
 */
export const SpacePanel = (props: SpacePanelProps) => {
  const {
    G, selected, viewer, me, locale, t, phase, canAct, selectedUnit, selectedUnitDef,
    setBattleFrom, setNavalFrom, cpRemaining, canActionCard, war,
    polishArmyDecision, polishReserveDecision, polishReserve, gwJointNavalAllies, gwJointNavalUnitIds,
    startMoveTargeting, doAction, moves,
  } = props;
  const battleFrom = props.battleFrom ?? null;
  const navalFrom = props.navalFrom ?? null;

  const computedRows = useSpaceActions({
    G, viewer, phase, selected, selectedUnit: selectedUnit ?? null,
    cp: cpRemaining ?? 0,
    canAct, canActionCard: canActionCard ?? false, war: war ?? null, me, moves, doAction,
    myOnMapArmies: props.myOnMapArmies ?? 0,
    myForts: props.myForts ?? 0,
    myMinorAllies: props.myMinorAllies ?? 0,
    ownLandInSelected: props.ownLandInSelected ?? [],
    ownNavalInSelected: props.ownNavalInSelected ?? [],
    potentialLandTargets: props.potentialLandTargets ?? [],
    potentialNavalTargets: props.potentialNavalTargets ?? [],
    deployLimit: props.deployLimit ?? 0,
    deployFree: props.deployFree ?? false,
    canDeployHere: props.canDeployHere ?? false,
    canGwDraft: props.canGwDraft ?? false,
    canGwDeployHere: props.canGwDeployHere ?? false,
    polishArmyDecision: polishArmyDecision ?? null,
    polishReserveDecision: polishReserveDecision ?? null,
    polishReserve: polishReserve ?? false,
    gwJointNavalAllies: gwJointNavalAllies ?? [],
    gwJointNavalUnitIds: gwJointNavalUnitIds ?? (() => []),
    startMoveTargeting,
    startBattle: () => battleFrom !== selected && invokeSetter(setBattleFrom, selected),
    startNavalBattle: () => navalFrom !== selected && invokeSetter(setNavalFrom, selected),
    locale, battleFrom, navalFrom,
  });
  const rows = props.rows ?? computedRows;

  return (
    <>
      <SpaceDetailPanel
        G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
        selectedUnitIds={props.selectedUnitIds}
        pending={props.pending ?? null} canDecide={props.canDecide ?? false}
        doAction={doAction} moves={moves}
      />
      <SpaceUnitPicker
        G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
        selectedUnit={selectedUnit ?? null}
        setSelectedUnit={props.setSelectedUnit ?? (() => undefined)}
        selectedUnitIds={props.selectedUnitIds}
        toggleUnitSelection={props.toggleUnitSelection}
        selectUnitGroup={props.selectUnitGroup}
        pending={props.pending ?? null} canDecide={props.canDecide ?? false}
        doAction={doAction} moves={moves}
      />
      <SpaceActionsPanel
        G={G}
        selected={selected}
        viewer={viewer}
        me={me}
        locale={locale}
        t={t}
        phase={phase}
        canAct={canAct}
        onOpenReference={props.onOpenReference}
        rows={rows}
        cpRemaining={cpRemaining ?? 0}
        polishReserve={polishReserve ?? false}
        setPolishReserve={props.setPolishReserve ?? (() => undefined)}
        selectedUnitDef={selectedUnitDef}
        setSelectedUnit={props.setSelectedUnit ?? (() => undefined)}
        battleFrom={battleFrom ?? null}
        setBattleFrom={(id) => invokeSetter(setBattleFrom, id)}
        navalFrom={navalFrom ?? null}
        setNavalFrom={(id) => invokeSetter(setNavalFrom, id)}
      />
    </>
  );
};
