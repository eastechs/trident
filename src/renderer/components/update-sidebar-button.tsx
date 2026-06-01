import { DownloadIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Hidden until the main process reports a downloaded update. When shown, the
// red dot signals an update is staged; clicking installs it and restarts.
export function UpdateSidebarButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateReady) return;
    const unsubscribe = api.onUpdateReady(() => setReady(true));
    return unsubscribe;
  }, []);

  if (!ready) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          onClick={() => window.electronAPI?.installUpdate()}
        >
          <DownloadIcon className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
          <span className="sr-only">Install available</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Install available</TooltipContent>
    </Tooltip>
  );
}
