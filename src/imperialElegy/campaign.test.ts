import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {POWERS} from "./types";
const wait=(ms=60)=>new Promise(r=>setTimeout(r,ms));

jest.setTimeout(120000);
test("campaign auto-play reaches a result", async () => {
  const cs=["0","1","2","3","4","5"].map(playerID=>Client({game:ImperialElegyGameDef,numPlayers:6,multiplayer:Local(),playerID,debug:false}));
  cs.forEach(c=>c.start()); await wait(150);
  const phases: string[] = [];
  let lastPhase = "";
  for(let step=0; step<900; step++){
    const G=cs[0].getState()!.G;
    const seatState=(p:string)=>cs[POWERS.indexOf(p as any)].getState()!.G;
    if(G.result){ break; }
    if(G.phase!==lastPhase){ phases.push(`${G.turn}:${G.phase}`); lastPhase=G.phase; }
    // Every phase can suspend on a pending decision (the GW draft's second
    // space, colonial transfers, neutral entry, ...).  Answer it before the
    // phase-specific action, otherwise the loop sends an action the engine
    // rejects and never reaches a result.
    if(G.pending){
      const p=G.pending.power; const i=POWERS.indexOf(p); const own=seatState(p);
      const opt=own.pending?.options[0];
      if(!opt) cs[i].moves.declinePending(); else cs[i].moves.resolvePending(opt.id);
      await wait(30); continue;
    }
    if(G.phase==="prep"){
      const i=Number(cs[0].getState()!.ctx.currentPlayer);
      const p=POWERS[i]; const own=seatState(p);
      if(!own.powers[p].flags.prepDone) cs[i].moves.finishPrep();
      await wait(40); continue;
    }
    if(G.phase==="diplomacy"){
      const i=Number(cs[0].getState()!.ctx.currentPlayer);
      const p=POWERS[i]; const own=seatState(p); const h=own.powers[p].homeCards[0];
      if(!h){ throw new Error("no home card"); }
      cs[i].moves.chooseHomeCard(h);
      await wait(40); continue;
    }
    if(G.phase==="action"){
      if(G.pending){
        const p=G.pending.power; const i=POWERS.indexOf(p); const own=seatState(p);
        const opt=own.pending?.options[0];
        if(!opt) cs[i].moves.declinePending(); else cs[i].moves.resolvePending(opt.id);
        await wait(30); continue;
      }
      const p=G.activePower; const i=POWERS.indexOf(p); const own=seatState(p); const hand=own.powers[p].hand;
      if(own.cpRemaining>0){ cs[i].moves.endImpulse(); await wait(30); continue; }
      const defs=(await import("./constant/cards.data")).CARDS;
      const findDef=(id:string)=>defs.actions.find(c=>c.id===id)??defs.home.find(c=>c.id===id)??defs.greatWar.find(c=>c.id===id);
      const playable=hand.find(id=>{const d=findDef(id); return d && (!["response","combat"].includes(d.type));});
      if(hand.length===0 || !playable){ cs[i].moves.pass(); await wait(30); continue; }
      const card=playable;
      const cardDef = findDef(card);
      const mandatory=cardDef?.type==="mandatory"||cardDef?.type==="mandatoryResponse";
      cs[i].moves.playCard(card, mandatory?"event":"cp");
      await wait(30);
      const after=seatState(p);
      if(after.phase==="action" && !after.pending && after.activePower===p){ cs[i].moves.endImpulse(); await wait(30); }
      continue;
    }
    if(G.phase==="end"){
      if(G.pending){
        const p=G.pending.power; const i=POWERS.indexOf(p); const own=seatState(p);
        const opt=own.pending?.options[0];
        if(!opt) cs[i].moves.declinePending(); else cs[i].moves.resolvePending(opt.id);
        await wait(30); continue;
      }
      let did=false;
      for(const p of POWERS){ const i=POWERS.indexOf(p); const own=seatState(p); const choices=String(own.powers[p].flags.ngChoices??"").split(",").filter(Boolean); if(choices.length){ cs[i].moves.chooseGoal(choices[0]); did=true; break; } }
      if(did){ await wait(30); continue; }
      for(const p of POWERS){ const i=POWERS.indexOf(p); const own=seatState(p); if(!own.powers[p].flags.endDone){ cs[i].moves.endPhaseTurn(); did=true; break; } }
      if(!did){ throw new Error("end phase stuck"); }
      await wait(30); continue;
    }
    if(G.phase==="wartime"){
      if(G.pending){
        const p=G.pending.power; const i=POWERS.indexOf(p); const own=seatState(p);
        const opt=own.pending?.options[0];
        if(!opt) cs[i].moves.declinePending(); else cs[i].moves.resolvePending(opt.id);
        await wait(30); continue;
      }
      const p=G.activePower; const i=POWERS.indexOf(p);
      cs[i].moves.passWarMove(); await wait(30); continue;
    }
    if(G.phase==="gwPlanning"){ cs[0].moves.endGwPlanningMove(); await wait(30); continue; }
    if(G.phase==="gwManeuver"){
      const p=G.activePower; const i=POWERS.indexOf(p); cs[i].moves.gwPass(); await wait(30); continue;
    }
    throw new Error(`unknown phase ${G.phase}`);
  }
  const G=cs[0].getState()!.G;
  expect(G.result).not.toBeNull();
  // The auto-play path now takes the printed decisions added in rounds 1-2
  // (crisis, consent, auctions, end-phase choices), so the campaign may end
  // either at turn 7 or with a Great War alliance victory.  The invariant is
  // that it reaches a decisive, non-empty result.
  expect(["endOfTurn7", "greatWar:te", "greatWar:ta"]).toContain(G.result!.reason);
  expect(G.result!.winners.length).toBeGreaterThan(0);
});
