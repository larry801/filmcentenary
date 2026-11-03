import React from "react";
import {createTheme, ThemeProvider} from "@mui/material/styles";

const serif = 'Georgia, "Noto Serif SC", "Songti SC", serif';

export const virginQueenTheme = createTheme({
    palette: {
        primary: {main: "#77551f", contrastText: "#fff8e8"},
        secondary: {main: "#395f5b"},
        background: {default: "#251e19", paper: "#f4eddd"},
        text: {primary: "#30291e", secondary: "#71634e"},
        divider: "#d6c8ad",
        success: {main: "#3d6549"},
    },
    typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 13,
        h5: {fontFamily: serif, fontWeight: 700},
        h6: {fontFamily: serif, fontWeight: 700},
        subtitle1: {fontFamily: serif, fontWeight: 700},
        subtitle2: {fontWeight: 700},
        button: {textTransform: "none", fontWeight: 600},
        caption: {fontSize: "0.75rem", lineHeight: 1.6},
    },
    shape: {borderRadius: 6},
    components: {
        MuiPaper: {styleOverrides: {root: {backgroundImage: "none"}}},
        MuiButton: {defaultProps: {disableElevation: true}, styleOverrides: {root: {minHeight: 36}}},
        MuiIconButton: {styleOverrides: {root: {minWidth: 40, minHeight: 40}}},
        MuiChip: {defaultProps: {size: "small"}, styleOverrides: {root: {fontWeight: 600}}},
        MuiTab: {styleOverrides: {root: {minHeight: 42, textTransform: "none"}}},
        MuiTabs: {styleOverrides: {root: {minHeight: 42}}},
        MuiDrawer: {styleOverrides: {paper: {backgroundColor: "#f4eddd"}}},
    },
});

export const VQSurface = ({children, className = ""}: React.PropsWithChildren<{className?: string}>) =>
    <ThemeProvider theme={virginQueenTheme}><div className={`vq-surface ${className}`}>{children}</div></ThemeProvider>;

export const ActionGroup = ({title, children}: React.PropsWithChildren<{title: string}>) =>
    <details className="vq-disclosure"><summary>{title}</summary><div className="vq-disclosure-content">{children}</div></details>;
