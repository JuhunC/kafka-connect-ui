// Shows a stack trace: first line always visible, full trace collapsible,
// rendered monospace.

import { useState, type ReactElement } from "react";
import { Box, Button, Collapse, Paper, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

export function ErrorTrace({ trace }: { trace: string }): ReactElement {
  const [open, setOpen] = useState(false);
  const firstLine = trace.split("\n")[0];
  const hasMore = trace.includes("\n");

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, bgcolor: "action.hover", overflow: "hidden" }}
    >
      <Typography
        component="pre"
        sx={{
          fontFamily: "monospace",
          fontSize: 12,
          m: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "error.main",
        }}
      >
        {firstLine}
      </Typography>

      {hasMore && (
        <>
          <Collapse in={open}>
            <Box
              component="pre"
              sx={{
                fontFamily: "monospace",
                fontSize: 12,
                mt: 1,
                mb: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {trace}
            </Box>
          </Collapse>
          <Button
            size="small"
            onClick={() => setOpen((v) => !v)}
            startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mt: 0.5 }}
          >
            {open ? "Hide full trace" : "Show full trace"}
          </Button>
        </>
      )}
    </Paper>
  );
}
