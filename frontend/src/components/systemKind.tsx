// Maps an external-system `kind` to an icon. Kafka gets its own hub icon.

import type { ReactElement } from "react";
import StorageIcon from "@mui/icons-material/Storage";
import DnsIcon from "@mui/icons-material/Dns";
import CloudIcon from "@mui/icons-material/Cloud";
import SearchIcon from "@mui/icons-material/Search";
import TableChartIcon from "@mui/icons-material/TableChart";
import HubIcon from "@mui/icons-material/Hub";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import type { SvgIconProps } from "@mui/material/SvgIcon";

export function SystemKindIcon({
  kind,
  ...props
}: { kind: string | null } & SvgIconProps): ReactElement {
  switch ((kind ?? "").toLowerCase()) {
    case "postgres":
    case "mysql":
    case "jdbc":
      return <StorageIcon {...props} />;
    case "splunk":
      return <DnsIcon {...props} />;
    case "elasticsearch":
      return <SearchIcon {...props} />;
    case "s3":
      return <CloudIcon {...props} />;
    case "kafka":
      return <HubIcon {...props} />;
    case "generic":
      return <DeviceHubIcon {...props} />;
    default:
      return <TableChartIcon {...props} />;
  }
}
