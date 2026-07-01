// MUI theme factory. Light/dark chosen from prefers-color-scheme at startup.

import { createTheme, type Theme } from "@mui/material/styles";

export function buildTheme(mode: "light" | "dark"): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === "dark" ? "#7ca9ff" : "#1f5fd6" },
      background:
        mode === "dark"
          ? { default: "#0f1420", paper: "#161c2b" }
          : { default: "#f5f6fa", paper: "#ffffff" },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily:
        '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h6: { fontWeight: 700 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
    },
  });
}

export function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}
