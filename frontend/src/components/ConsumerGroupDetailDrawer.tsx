// Right-hand detail drawer for a Kafka consumer group. Used both from the
// Consumer Groups tab (row click) and as an overlay on the Topology tab
// (clicking a consumer-group node), the same way ConnectorDetailDrawer works.

import type { ReactElement } from "react";
import { Box, Chip, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import { HealthPill } from "./HealthPill";
import type { ConsumerGroupDto } from "../api/types";

export function ConsumerGroupDetailDrawer({
  group,
  onClose,
}: {
  group: ConsumerGroupDto | null;
  onClose: () => void;
}): ReactElement {
  return (
    <Drawer anchor="right" open={group !== null} onClose={onClose}>
      <Box sx={{ width: 380, p: 2 }} role="presentation">
        {group && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupWorkIcon color="secondary" />
              <Typography variant="h6" sx={{ flexGrow: 1, wordBreak: "break-all" }}>
                {group.groupId}
              </Typography>
              <IconButton onClick={onClose} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <HealthPill health={group.health} />
              <Chip size="small" variant="outlined" label={group.state} />
            </Stack>

            <Divider />

            <Stack spacing={0.5}>
              <DetailRow label="Members" value={String(group.memberCount)} />
              <DetailRow
                label="Coordinator"
                value={group.coordinatorId == null ? "—" : String(group.coordinatorId)}
              />
              <DetailRow
                label="Total lag"
                value={group.totalLag == null ? "—" : group.totalLag.toLocaleString()}
              />
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Topics ({group.topics.length})</Typography>
            {group.topics.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No committed topics.
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {group.topics.map((t) => (
                  <Chip key={t} size="small" label={t} />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
