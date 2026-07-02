// HealthPill renders a Health or Reachability with REDUNDANT encoding:
// color + icon + text label (WCAG: never color alone).

import { Chip, type ChipProps } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import CancelIcon from "@mui/icons-material/Cancel";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import HelpIcon from "@mui/icons-material/Help";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import type { ReactElement } from "react";
import type { Health, Reachability } from "../api/types";

type MuiColor = "success" | "warning" | "error" | "default" | "info";

interface Descriptor {
  color: MuiColor;
  label: string;
  icon: ReactElement;
}

const HEALTH_MAP: Record<Health, Descriptor> = {
  RUNNING: { color: "success", label: "Running", icon: <CheckCircleIcon /> },
  DEGRADED: { color: "warning", label: "Degraded", icon: <WarningIcon /> },
  FAILED: { color: "error", label: "Failed", icon: <CancelIcon /> },
  PAUSED: { color: "default", label: "Paused", icon: <PauseCircleIcon /> },
  STOPPED: { color: "default", label: "Stopped", icon: <PauseCircleIcon /> },
  UNASSIGNED: { color: "warning", label: "Unassigned", icon: <WarningIcon /> },
  RESTARTING: { color: "info", label: "Restarting", icon: <RestartAltIcon /> },
  UNKNOWN: { color: "default", label: "Unknown", icon: <HelpIcon /> },
};

const REACHABILITY_MAP: Record<Reachability, Descriptor> = {
  REACHABLE: { color: "success", label: "Reachable", icon: <CheckCircleIcon /> },
  DEGRADED: { color: "warning", label: "Degraded", icon: <WarningIcon /> },
  UNREACHABLE: { color: "error", label: "Unreachable", icon: <CancelIcon /> },
  UNKNOWN: { color: "default", label: "Unknown", icon: <HelpIcon /> },
};

export interface HealthPillProps {
  health?: Health;
  reachability?: Reachability;
  size?: ChipProps["size"];
  variant?: ChipProps["variant"];
  /** Override the displayed text (color + icon still derive from health/reachability). */
  label?: string;
}

export function HealthPill({
  health,
  reachability,
  size = "small",
  variant = "filled",
  label,
}: HealthPillProps): ReactElement {
  const d: Descriptor = reachability
    ? REACHABILITY_MAP[reachability]
    : HEALTH_MAP[health ?? "UNKNOWN"];

  const text = label ?? d.label;

  return (
    <Chip
      size={size}
      variant={variant}
      color={d.color}
      icon={d.icon}
      label={text}
      aria-label={`Status: ${text}`}
    />
  );
}
