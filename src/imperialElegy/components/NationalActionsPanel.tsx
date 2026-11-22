import React from "react";
import {Power, SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {AU_NATIONALITIES} from "../engine/characteristics";
import {nationalityLabel} from "../engine/nationality";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";

export interface NationalActionsPanelProps {
  show: boolean;
  viewer: Power;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  cpBudget: () => number;
  // FR
  zouaveInPlay: boolean;
  zouaveReason: string | undefined;
  // AU
  auReformValue: string;
  setAuReformTarget: (s: string) => void;
  auReformDecision: {allowed: boolean; reasons: string[]} | null;
  auReformReason: string | undefined;
  auCitizenValue: string;
  setAuCitizenTarget: (s: string) => void;
  auCitizenDecision: {allowed: boolean; reasons: string[]} | null;
  auCitizenRoll: {difficulty: number; rollNeeded: number; guaranteed: boolean; impossible: boolean} | null;
  auCitizenReason: string | undefined;
  auSacrifice: boolean;
  setAuSacrifice: (b: boolean) => void;
  auIncorporateCandidates: string[];
  auIncorporateValue: string;
  setAuIncorporateTarget: (s: string) => void;
  auIncorporate: {allowed: boolean; reasons: string[]} | null;
  auIncorporateReason: string | undefined;
  // RU / TSRR
  tsrrArmies: {id: string; space?: SpaceId | null}[];
  tsrrUnitValue: string;
  setTsrrUnitId: (s: string) => void;
  tsrrDestinations: SpaceId[];
  tsrrToValue: string;
  setTsrrTo: (s: string) => void;
  tsrrDecision: {allowed: boolean; reasons: string[]} | null;
  tsrrReason: string | undefined;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const NationalActionsPanel = (props: NationalActionsPanelProps) => {
  const {
    show, viewer, locale, t, cpBudget,
    zouaveInPlay, zouaveReason,
    auReformValue, setAuReformTarget, auReformDecision, auReformReason,
    auCitizenValue, setAuCitizenTarget, auCitizenDecision, auCitizenRoll, auCitizenReason,
    auSacrifice, setAuSacrifice,
    auIncorporateCandidates, auIncorporateValue, setAuIncorporateTarget, auIncorporate, auIncorporateReason,
    tsrrArmies, tsrrUnitValue, setTsrrUnitId, tsrrDestinations, tsrrToValue, setTsrrTo, tsrrDecision, tsrrReason,
    doAction, moves,
  } = props;
  if (!show) return null;
  return (
    <IEPanel title={t.nationalActions} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
      <div className="ie-national-actions" data-testid="ie-national-actions">
        {viewer === "FR" && (
          <div className="ie-inline" data-testid="ie-fr-actions">
            <button className="ie-btn" data-testid="ie-rebuild-zouave" disabled={cpBudget() < 1 || zouaveInPlay} title={zouaveReason} onClick={() => doAction(() => moves.rebuildZouave(), {label: t.rebuildZouave, reason: zouaveReason})}>{t.rebuildZouave}</button>
          </div>
        )}

        {viewer === "AU" && (
          <div data-testid="ie-au-actions">
            <div className="ie-inline">
              <span className="ie-section-title">{t.auTargetNationality}</span>
              <select className="ie-select" data-testid="ie-au-reform-target" value={auReformValue} onChange={(e) => setAuReformTarget(e.target.value)}>
                {AU_NATIONALITIES.map((nationality) => <option key={nationality} value={nationality}>{nationalityLabel(nationality, locale)}</option>)}
              </select>
              <button className="ie-btn" data-testid="ie-au-reforms" disabled={auReformDecision?.allowed !== true || cpBudget() < 3} title={auReformReason} onClick={() => doAction(() => moves.auAction("reforms", auReformValue), {label: t.auReforms, reason: auReformReason})}>{t.auReforms}</button>
            </div>
            <div className="ie-inline">
              <span className="ie-section-title">{t.auTargetNationality}</span>
              <select className="ie-select" data-testid="ie-au-citizenship-target" value={auCitizenValue} onChange={(e) => setAuCitizenTarget(e.target.value)}>
                {AU_NATIONALITIES.map((nationality) => <option key={nationality} value={nationality}>{nationalityLabel(nationality, locale)}</option>)}
              </select>
              <label className="ie-muted">
                <input type="checkbox" data-testid="ie-au-sacrifice" checked={auSacrifice} onChange={(e) => setAuSacrifice(e.target.checked)}/> {t.auSacrificeStability}
              </label>
              <button className="ie-btn" data-testid="ie-au-citizenship" disabled={auCitizenDecision?.allowed !== true || cpBudget() < 3} title={auCitizenReason} onClick={() => doAction(() => moves.auAction("expandCitizenship", auCitizenValue, auSacrifice), {label: t.auExpandCitizenship, reason: auCitizenReason})}>{t.auExpandCitizenship}</button>
              {auCitizenRoll !== null && (
                <span className="ie-muted" data-testid="ie-au-citizenship-roll">
                  {auCitizenRoll.guaranteed
                    ? bi(locale, "Automatic success", "自动成功")
                    : auCitizenRoll.impossible
                      ? bi(locale, "Cannot succeed (needs over 6)", "无法成功（需要大于 6）")
                      : auCitizenRoll.rollNeeded < auCitizenRoll.difficulty
                        ? bi(locale, `Roll ${auCitizenRoll.rollNeeded}+ (difficulty ${auCitizenRoll.difficulty}, -${auCitizenRoll.difficulty - auCitizenRoll.rollNeeded} DRM)`, `掷 ${auCitizenRoll.rollNeeded}+（难度 ${auCitizenRoll.difficulty}，修正 -${auCitizenRoll.difficulty - auCitizenRoll.rollNeeded}）`)
                        : bi(locale, `Roll ${auCitizenRoll.rollNeeded}+ (difficulty ${auCitizenRoll.difficulty})`, `掷 ${auCitizenRoll.rollNeeded}+（难度 ${auCitizenRoll.difficulty}）`)}
                </span>
              )}
            </div>
            <div className="ie-inline">
              <span className="ie-section-title">{t.auTargetMinor}</span>
              <select className="ie-select" data-testid="ie-au-incorporate-target" value={auIncorporateValue} onChange={(e) => setAuIncorporateTarget(e.target.value)} disabled={auIncorporateCandidates.length === 0}>
                {auIncorporateCandidates.length === 0
                  ? <option value="">{bi(locale, "No allied minor power", "没有盟国小国")}</option>
                  : auIncorporateCandidates.map((space) => <option key={space} value={space}>{spaceLabel(space, locale)}</option>)}
              </select>
              <button className="ie-btn" data-testid="ie-au-incorporate" disabled={auIncorporate?.allowed !== true || cpBudget() < 3} title={auIncorporateReason} onClick={() => doAction(() => moves.auAction("incorporate", auIncorporateValue), {label: t.auIncorporate, reason: auIncorporateReason})}>{t.auIncorporate}</button>
            </div>
          </div>
        )}

        {(viewer === "RU" || tsrrArmies.length > 0) && (
          <div className="ie-inline" data-testid="ie-tsrr-actions">
            <span className="ie-section-title">{t.tsrrRailMove}</span>
            <select className="ie-select" data-testid="ie-tsrr-unit" value={tsrrUnitValue} onChange={(e) => setTsrrUnitId(e.target.value)} disabled={tsrrArmies.length === 0}>
              {tsrrArmies.length === 0
                ? <option value="">{bi(locale, "No army on the railroad", "铁路上没有军团")}</option>
                : tsrrArmies.map((unit) => <option key={unit.id} value={unit.id}>{unit.id} · {unit.space ? spaceLabel(unit.space, locale) : ""}</option>)}
            </select>
            <select className="ie-select" data-testid="ie-tsrr-destination" value={tsrrToValue} onChange={(e) => setTsrrTo(e.target.value)} disabled={tsrrDestinations.length === 0}>
              {tsrrDestinations.map((space) => <option key={space} value={space}>{spaceLabel(space, locale)}</option>)}
            </select>
            <button className="ie-btn" data-testid="ie-tsrr-rail" disabled={tsrrDecision?.allowed !== true} title={tsrrReason} onClick={() => doAction(() => moves.tsrrRailMove(tsrrUnitValue, tsrrToValue), {label: t.tsrrRailMove, reason: tsrrReason})}>{t.tsrrRailMove}</button>
          </div>
        )}
      </div>
    </IEPanel>
  );
};
