import {
    IChangePlayerSettingArgs,
    IChooseEventArg,
    IChooseHandArg,
    ICommentArg, ICompetitionCardArg,
    IPayAdditionalCostArgs,
    IPeekArgs,
    IPlayCardInfo,
    IRegionChooseArg, ISetupGameModeArgs,
    IShowBoardStatusProps,
    IShowCompetitionResultArgs,
    ITargetChooseArgs, IUpdateSlotProps
} from "../../game/moves";
import {ClassicFilmAutoMoveMode, GameMode, GameTurnOrder, IBuyInfo} from "../../types/core";

export interface LocaleClassicFilmAutoMoveMode {
    MODE_NAME: string,
    NO_AUTO: string,
    DRAW_CARD: string,
    AESTHETICS_AWARD: string,
}

export interface LocaleRegions {
    0: string,
    1: string,
    2: string,
    3: string,
    4: string,
    5: string,
}

export interface LocaleSettings {
    mode: string,
    team: string,
    normal: string,
    newbie: string,
    enableSchoolExtension: string,
    randomFirst: string,
    fixedFirst: string,
    allRandom: string,
    order: string,
    changeSetting: string
}

export const argSetupGameModeHOF = (chose: string, setting: LocaleSettings) => {
    return {
        args: (args: ISetupGameModeArgs[]): string => {
            const arg = args[0]
            let t = chose;
            switch (arg.mode) {
                case GameMode.NEWBIE:
                    t += setting.newbie;
                    break;
                case GameMode.NORMAL:
                    t += setting.normal
                    break;
                case GameMode.TEAM2V2:
                    t += setting.team;
                    break;
            }
            t += ", "
            switch (arg.order) {
                case GameTurnOrder.ALL_RANDOM:
                    t += setting.allRandom;
                    break;
                case GameTurnOrder.FIRST_RANDOM:
                    t += setting.randomFirst
                    break;
                case GameTurnOrder.FIXED:
                    t += setting.fixedFirst
                    break;
            }
            if (arg.enableSchoolExtension){
                t += setting.enableSchoolExtension
            }
            return t;
        }
    }
}

export const argChangePlayerSettingHOF = (chose: string, classicFilmAutoMoveMode: LocaleClassicFilmAutoMoveMode) => {
    return {
        args: (args: IChangePlayerSettingArgs[]): string => {
            const arg = args[0]
            let t = chose + classicFilmAutoMoveMode.MODE_NAME;
            switch (arg.classicFilmAutoMoveMode) {
                case ClassicFilmAutoMoveMode.DRAW_CARD:
                    t += classicFilmAutoMoveMode.DRAW_CARD;
                    break;
                case ClassicFilmAutoMoveMode.AESTHETICS_AWARD:
                    t += classicFilmAutoMoveMode.AESTHETICS_AWARD;
                    break;
                case ClassicFilmAutoMoveMode.NO_AUTO:
                    t += classicFilmAutoMoveMode.NO_AUTO;
                    break;
            }
            return t;
        }
    }
}

export const argChooseRegionHOF = (chose: string, region: LocaleRegions) => {
    return {
        args: (arg: IRegionChooseArg[]): string => {
            let a = arg[0]
            let t = chose
            t += region[a.r]
            return t
        }
    }
}

export const moveHOF = (
    argBreakthrough: { args: (arg: IPlayCardInfo[]) => string },
    argBuyCard: { args: (arg: IBuyInfo[]) => string },
    argChangePlayerSetting: { args: (arg: IChangePlayerSettingArgs[]) => string },
    argChooseEvent: { args: (arg: IChooseEventArg[]) => string },
    argChooseHand: { args: (arg: IChooseHandArg[]) => string },
    argChooseRegion: { args: (arg: IRegionChooseArg[]) => string },
    argChooseTarget: { args: (arg: ITargetChooseArgs[]) => string },
    argComment: { args: (arg: ICommentArg[]) => string },
    argCompetitionCard: { args: (arg: ICompetitionCardArg[]) => string },
    argConcede: { args: () => string },
    argConfirmRespond: { args: (arg: string[]) => string },
    argDrawCard: { args: () => string },
    argPayAdditionalCost: { args: (arg: IPayAdditionalCostArgs[]) => string },
    argPeek: { args: (arg: IPeekArgs[]) => string },
    argPlayCard: { args: (arg: IPlayCardInfo[]) => string },
    argRequestEndTurn: { args: () => string },
    argSetupGameMode: { args: (arg: ISetupGameModeArgs[]) => string },
    argShowBoardStatus: { args: (arg: IShowBoardStatusProps[]) => string },
    argShowCompetitionResult: { args: (arg: IShowCompetitionResultArgs[]) => string },
    argUpdateSlot: { args: (arg: IUpdateSlotProps[]) => string },
) => {
    return {
        changePlayerSetting: ["{{args}}", argChangePlayerSetting],
        setupGameMode: ["{{args}}", argSetupGameMode],
        concede: ["{{args}}", argConcede],
        showBoardStatus: ["{{args}}", argShowBoardStatus],
        chooseEvent: ["{{args}}", argChooseEvent],
        chooseHand: ["{{args}}", argChooseHand],
        chooseRegion: ["{{args}}", argChooseRegion],
        chooseTarget: ["{{args}}", argChooseTarget],
        peek: ["{{args}}", argPeek],
        showCompetitionResult: ["{{args}}", argShowCompetitionResult],
        competitionCard: ["{{args}}", argCompetitionCard],
        drawCard: ["{{args}}", argDrawCard],
        buyCard: ["{{args}}", argBuyCard],
        playCard: ["{{args}}", argPlayCard],
        breakthrough: ["{{args}}", argBreakthrough],
        requestEndTurn: ["{{args}}", argRequestEndTurn],
        updateSlot: ["{{args}}", argUpdateSlot],
        comment: ["{{args}}", argComment],
        confirmRespond: ["{{args}}", argConfirmRespond],
        payAdditionalCost: ["{{args}}", argPayAdditionalCost],
    }
}