import {createTheme} from "@mui/material/styles";
import tokens from "../design/tokens.json";

/**
 * The Imperial Elegy palette, read from the single token source
 * (`src/imperialElegy/design/tokens.json`).  There are no hex literals here:
 * the stylesheet generator and the MUI theme both consume the same JSON.
 */
export const IE_COLORS = {
  table: tokens.color.table,
  table2: tokens.color["table-2"],
  panel: tokens.color.panel,
  panel2: tokens.color["panel-2"],
  panel3: tokens.color["panel-3"],
  rule: tokens.color.rule,
  ruleStrong: tokens.color["rule-strong"],
  onDark: tokens.color["on-dark"],
  onDark2: tokens.color["on-dark-2"],
  onDarkMuted: tokens.color["on-dark-muted"],
  paper: tokens.color.paper,
  paper2: tokens.color["paper-2"],
  paper3: tokens.color["paper-3"],
  paperRule: tokens.color["paper-rule"],
  ink: tokens.color.ink,
  ink2: tokens.color["ink-2"],
  inkMuted: tokens.color["ink-muted"],
  brass: tokens.color.brass,
  brassSoft: tokens.color["brass-soft"],
  brassDeep: tokens.color["brass-deep"],
  brassInk: tokens.color["brass-ink"],
  overprint: tokens.color.overprint,
  overprintBorderDark: tokens.color["overprint-border-dark"],
  overprintTextDark: tokens.color["overprint-text-dark"],
  focusDark: tokens.color["focus-dark"],
  focusPaper: tokens.color["focus-paper"],
  ok: tokens.color.ok,
  okTextDark: tokens.color["ok-text-dark"],
  okTextPaper: tokens.color["ok-text-paper"],
  warn: tokens.color.warn,
  warnTextDark: tokens.color["warn-text-dark"],
  warnTextPaper: tokens.color["warn-text-paper"],
  danger: tokens.color.danger,
  dangerTextDark: tokens.color["danger-text-dark"],
  dangerTextPaper: tokens.color["danger-text-paper"],
} as const;

/**
 * The custom properties tokenised in the generated stylesheet.  Kept in the
 * theme so TSX and CSS cannot drift apart without the parity test failing.
 */
export function ieTokenNames(): string[] {
  const names: string[] = [];
  const add = (name: string) => names.push(`--ie-${name}`);

  for (const key of Object.keys(tokens.color)) add(key);

  for (const [power, values] of Object.entries(tokens.power)) {
    add(`power-${power}`);
    add(`power-${power}-on-dark`);
    add(`power-${power}-on-paper`);
    if ("onFill" in values) add(`power-${power}-on-fill`);
    if ("edge" in values) add(`power-${power}-edge`);
  }

  add("font-display");
  add("font-ui");
  add("font-data");
  for (const key of Object.keys(tokens.font.size)) {
    add(`font-${key}`);
    add(`font-${key}-line`);
    add(`font-${key}-weight`);
  }
  for (const key of Object.keys(tokens.space)) add(`space-${key}`);
  for (const key of Object.keys(tokens.radius)) add(`radius-${key}`);
  for (const key of Object.keys(tokens.shadow)) add(`shadow-${key}`);

  add("motion-press");
  add("motion-pop");
  add("motion-sheet");
  add("motion-easing-pop");
  add("motion-easing-sheet");

  return names;
}

export const IE_THEME_TOKENS = ieTokenNames();

/** MUI theme for the Imperial Elegy board, built from the tokens. */
export const ieTheme = createTheme({
  palette: {
    mode: "dark",
    background: {default: IE_COLORS.table, paper: IE_COLORS.panel},
    primary: {main: IE_COLORS.brass, contrastText: IE_COLORS.ink},
    secondary: {main: IE_COLORS.brassDeep},
    text: {primary: IE_COLORS.onDark, secondary: IE_COLORS.onDark2},
    divider: IE_COLORS.rule,
    error: {main: IE_COLORS.danger},
    warning: {main: IE_COLORS.warn},
    success: {main: IE_COLORS.ok},
    action: {focus: IE_COLORS.focusDark},
  },
  shape: {borderRadius: parseInt(tokens.radius.md, 10)},
  typography: {
    fontFamily: tokens.font.family.ui,
    fontSize: 14,
    button: {fontFamily: tokens.font.family.ui, fontWeight: 600},
    h1: {fontFamily: tokens.font.family.display, fontWeight: 600},
    h2: {fontFamily: tokens.font.family.display, fontWeight: 600},
  },
  components: {
    MuiButton: {
      defaultProps: {disableElevation: true},
      styleOverrides: {
        root: {
          borderRadius: parseInt(tokens.radius.sm, 10),
          textTransform: "none",
          fontWeight: 600,
          fontFamily: tokens.font.family.ui,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: 40,
          fontFamily: tokens.font.family.ui,
          fontSize: tokens.font.size.sm.size,
          color: IE_COLORS.onDark2,
          "&.Mui-selected": {
            color: IE_COLORS.ink,
            backgroundColor: IE_COLORS.paper,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {minHeight: 40},
        indicator: {backgroundColor: IE_COLORS.brass},
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: IE_COLORS.brassSoft,
          "&.Mui-checked": {color: IE_COLORS.brass},
        },
      },
    },
    MuiPaper: {styleOverrides: {root: {backgroundImage: "none"}}},
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: IE_COLORS.panel2,
          color: IE_COLORS.onDark,
          fontFamily: tokens.font.family.ui,
          fontSize: tokens.font.size.xs.size,
        },
        arrow: {color: IE_COLORS.panel2},
      },
    },
  },
});
