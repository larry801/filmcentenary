import {createTheme} from "@mui/material/styles";

/**
 * The Imperial Elegy palette.  The same values are mirrored by the stylesheet in
 * `--ie-*` custom properties, so both the React tree and plain CSS draw from one
 * vocabulary: parchment surfaces, a dark frame, gold accents and muted status
 * colours.
 */
export const IE_COLORS = {
  surface: "#efe4cc", surface2: "#e6d8ba", ink: "#2a2218",
  frame: "#211b16", frame2: "#2c241d", line: "#6d5636",
  accent: "#c8a84b", accentSoft: "#e6c987",
  ok: "#6f9d5a", warn: "#c87830", danger: "#a3432f",
} as const;

/** Body text on the dark frame. */
const TEXT_PRIMARY = "#eadfc8";
/** Secondary/label text on the dark frame. */
const TEXT_SECONDARY = "#c5b698";
/** Text drawn on the gold accent. */
const ACCENT_CONTRAST = "#1a1510";

/**
 * MUI theme for the Imperial Elegy board.  Without it, Tabs, Checkboxes and
 * friends fall back to MUI's default blue, which clashes with the brown/gold
 * surface.
 */
export const ieTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: IE_COLORS.frame,
      paper: IE_COLORS.frame2,
    },
    primary: {
      main: IE_COLORS.accent,
      contrastText: ACCENT_CONTRAST,
    },
    secondary: {main: "#8f6f3f"},
    text: {primary: TEXT_PRIMARY, secondary: TEXT_SECONDARY},
    divider: IE_COLORS.line,
    error: {main: IE_COLORS.danger},
    warning: {main: IE_COLORS.warn},
    success: {main: IE_COLORS.ok},
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 14,
  },
  components: {
    MuiButton: {
      defaultProps: {disableElevation: true},
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: 36,
          color: TEXT_SECONDARY,
          "&.Mui-selected": {color: IE_COLORS.accentSoft},
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {backgroundColor: IE_COLORS.accent},
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: IE_COLORS.accentSoft,
          "&.Mui-checked": {color: IE_COLORS.accent},
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {backgroundImage: "none"},
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: IE_COLORS.frame2,
          color: TEXT_PRIMARY,
        },
        arrow: {color: IE_COLORS.frame2},
      },
    },
  },
});

/**
 * The custom properties the Imperial Elegy stylesheet defines.  Kept here so the
 * TSX and the CSS cannot drift apart unnoticed.
 */
export const IE_THEME_TOKENS = [
  "--ie-surface",
  "--ie-surface-2",
  "--ie-line",
  "--ie-ink",
  "--ie-frame",
  "--ie-frame-2",
  "--ie-accent",
  "--ie-accent-soft",
  "--ie-ok",
  "--ie-warn",
  "--ie-danger",
  "--ie-space-1",
  "--ie-space-2",
  "--ie-space-3",
  "--ie-space-4",
  "--ie-radius-sm",
  "--ie-radius-md",
  "--ie-radius-lg",
  "--ie-font-xs",
  "--ie-font-sm",
  "--ie-font-md",
  "--ie-font-lg",
  "--ie-font-xl",
] as const;
