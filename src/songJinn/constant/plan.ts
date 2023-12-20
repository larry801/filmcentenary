import {PlanID, PlayerPendingEffect, ProvinceID, SJPlayer, SongJinnGame, VictoryReason} from "./general";
import {Ctx, PlayerID} from "boardgame.io";

export interface Plan {
    id: PlanID;
    name: string;
    vp: number;
    desc: string;
    level: number;
    provinces: ProvinceID[],
    effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => void,
}

export const getPlanById: (pid: PlanID) => Plan = (pid: PlanID) => {
    return idToPlan[pid];
}

const idToPlan = {
    [PlanID.J01]: {
        "id": PlanID.J01,
        "name": "早期京畿路",
        "desc": "核心/目标：开封   其他城市：无   首次完成/奖励选取奖励：下一个摸牌阶段，通过检索获得1张手牌，然后弃掉1张手牌",
        "level": 2,
        "provinces": [ProvinceID.JINGJILU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
            
        }
    },
    [PlanID.J02]: {
        "id": PlanID.J02,
        "name": "早期陕西六路",
        "desc": "核心/目标：长安   其他城市：天兴 肤施   首次完成/奖励选取奖励：提高【军事等级】1级",
        "level": 2,
        "provinces": [ProvinceID.SHANXILIULU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J03]: {
        "id": PlanID.J03,
        "name": "早期京西两路",
        "desc": "核心/目标：襄阳   其他城市：洛阳宛丘   首次完成/奖励选取奖励：提高【政策】/【殖民】1级",
        "level": 2,
        "provinces": [ProvinceID.JINGXILIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J04]: {
        "id": PlanID.J04,
        "name": "早期京东两路",
        "desc": "核心/目标：宋城   其他城市：历城须城   首次完成/奖励选取奖励：调整1个其他国家【外交】状态1级",
        "level": 2,
        "provinces": [ProvinceID.JINGDONGLIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J05]: {
        "id": PlanID.J05,
        "name": "早期淮南两路",
        "desc": "核心/目标：江都   其他城市：下蔡   首次完成/奖励选取奖励：提高【内政等级】1级",
        "level": 2,
        "provinces": [ProvinceID.HUAINANLIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J06]: {
        "id": PlanID.J06,
        "name": "早期河东路",
        "desc": "核心/目标：阳曲   其他城市：临汾上党   首次完成/奖励选取奖励：消灭总共2耐久度的部队",
        "level": 2,
        "provinces": [ProvinceID.HEDONGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J07]: {
        "id": PlanID.J07,
        "name": "中期京畿路",
        "desc": "核心/目标：开封   其他城市：无   首次完成/奖励选取奖励：下一个摸牌阶段，通过检索获得1张手牌，然后弃掉1张手牌",
        "level": 3,
        "provinces": [ProvinceID.JINGJILU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J08]: {
        "id": PlanID.J08,
        "name": "中期陕西六路",
        "desc": "核心/目标：长安   其他城市：   首次完成/奖励选取奖励：提高【军事等级】1级",
        "level": 3,
        "provinces": [ProvinceID.SHANXILIULU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J09]: {
        "id": PlanID.J09,
        "name": "中期淮南两路",
        "desc": "核心/目标：江都   其他城市：下蔡   首次完成/奖励选取奖励：提高【内政等级】1级",
        "level": 3,
        "provinces": [ProvinceID.HUAINANLIANGLU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J10]: {
        "id": PlanID.J10,
        "name": "中期京西两路",
        "desc": "核心/目标：襄阳   其他城市：洛阳宛丘   首次完成/奖励选取奖励：提高【政策】，【殖民】1级",
        "level": 3,
        "provinces": [ProvinceID.JINGXILIANGLU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J11]: {
        "id": PlanID.J11,
        "name": "中期荆湖两路",
        "desc": "核心/目标：江陵   其他城市：长沙安陆   首次完成/奖励选取奖励：提供4点【发展力】",
        "level": 2,
        "provinces": [ProvinceID.JINHULIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J12]: {
        "id": PlanID.J12,
        "name": "中期川峡四路",
        "desc": "核心/目标：成都   其他城市：南郑 郪县   首次完成/奖励选取奖励：摸1张牌",
        "level": 2,
        "provinces": [ProvinceID.CHUANSHANSILU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J13]: {
        "id": PlanID.J13,
        "name": "中期京东两路",
        "desc": "核心/目标：宋城   其他城市：历城须城   首次完成/奖励选取奖励：调整1个其他国家【外交】状态1级",
        "level": 3,
        "provinces": [ProvinceID.JINGDONGLIANGLU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J14]: {
        "id": PlanID.J14,
        "name": "中期江西两路",
        "desc": "核心/目标：江宁   其他城市：南昌   首次完成/奖励选取奖励：提高【政策】/【殖民】1级",
        "level": 2,
        "provinces": [ProvinceID.JINGXILIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J15]: {
        "id": PlanID.J15,
        "name": "中期河北两路",
        "desc": "核心/目标：元城   其他城市：真定 安喜 河间   首次完成/奖励选取奖励：在【元城】放置1个【拐子马】/【背嵬军】",
        "level": 2,
        "provinces": [ProvinceID.HEBEILIANGLU],
        "vp": 1,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J16]: {
        "id": PlanID.J16,
        "name": "中期川陕战区",
        "desc": "核心/目标：长安   其他城市：天兴 肤施 南郑 郪县   首次完成/奖励选取奖励：将1个在场的【将领】移出游戏",
        "level": 4,
        "provinces": [ProvinceID.SHANXILIULU, ProvinceID.CHUANSHANSILU],
        "vp": 4,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J17]: {
        "id": PlanID.J17,
        "name": "中期荆襄战区",
        "desc": "核心/目标：襄阳开封   其他城市：洛阳宛丘   首次完成/奖励选取奖励：将1个已完成的【作战计划】移出游戏",
        "level": 4,
        "provinces": [ProvinceID.JINGJILU, ProvinceID.JINGXILIANGLU],
        "vp": 4,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J18]: {
        "id": PlanID.J18,
        "name": "中期两淮战区",
        "desc": "核心/目标：江都宋城   其他城市：历城须城下蔡   首次完成/奖励选取奖励：将1个其他国家移出游戏",
        "level": 4,
        "provinces": [ProvinceID.HUAINANLIANGLU, ProvinceID.JINGDONGLIANGLU],
        "vp": 4,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J19]: {
        "id": PlanID.J19,
        "name": "后期京畿路",
        "desc": "核心/目标：开封   其他城市：无   首次完成/奖励选取奖励：无",
        "level": 4,
        "provinces": [ProvinceID.JINGJILU],
        "vp": 3,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J20]: {
        "id": PlanID.J20,
        "name": "后期陕西六路",
        "desc": "核心/目标：长安   其他城市：   首次完成/奖励选取奖励：无",
        "level": 4,
        "provinces": [ProvinceID.SHANXILIULU],
        "vp": 3,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
        }
    },
    [PlanID.J21]: {
        "id": PlanID.J21,
        "name": "后期淮南两路",
        "desc": "核心/目标：江都   其他城市：下蔡   首次完成/奖励选取奖励：下回合可以选取2张【作战计划】",
        "level": 3,
        "provinces": [ProvinceID.HUAINANLIANGLU],
        "vp": 2,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
            const pub = pid === SJPlayer.P1  ? G.song : G.jinn;
            pub.effect.push(PlayerPendingEffect.TwoPlan);
        }
    },
    [PlanID.J22]: {
        "id": PlanID.J22,
        "name": "后期京西两路",
        "desc": "核心/目标：襄阳   其他城市：洛阳宛丘   首次完成/奖励选取奖励：无",
        "level": 4,
        "provinces": [ProvinceID.JINGXILIANGLU],
        "vp": 3,
        effect: (G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {}
    },
    [PlanID.J23]: {
        "id": PlanID.J23,
        "name": "还我河山",
        "desc": "核心/目标：长安 宋城 元城 开封    其他城市：肤施天兴须城历城河间安喜真定   首次完成/奖励选取奖励：自动获胜；若未完成，当【绍兴和议】时，每座计划内的城市1分",
        "level": 5,
        "provinces": [ProvinceID.SHANXILIULU, ProvinceID.JINGJILU, ProvinceID.JINGDONGLIANGLU, ProvinceID.HEBEILIANGLU],
        "vp": 0,
        effect: (_G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
            ctx.events?.endGame({
                winner:pid,
                reason: VictoryReason.HuanWoHeShan
            });
        }
    },
    [PlanID.J24]: {
        "id": PlanID.J24,
        "name": "吴山立马",
        "desc": "核心/目标：江宁襄阳江都开封   其他城市：下蔡南昌洛阳宛丘   首次完成/奖励选取奖励：自动获胜；若未完成，当【绍兴和议】时，每座计划内的城市1分",
        "level": 5,
        "provinces": [ProvinceID.JINGJILU, ProvinceID.JINGXILIANGLU, ProvinceID.JIANGNANLIANGLU, ProvinceID.HUAINANLIANGLU],
        "vp": 0,
        effect: (_G: SongJinnGame, ctx: Ctx, pid:PlayerID) => {
            ctx.events?.endGame({
                winner:pid,
                reason: VictoryReason.WuShanLiMa
            });
        }
    },

}