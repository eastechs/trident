import { CircleHelpIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HelpSidebarButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    // Open in a separate window via Electron IPC; fall back to in-app nav
    if (window.electronAPI?.openDocumentation) {
      window.electronAPI.openDocumentation();
    } else {
      navigate("/documentation");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={handleClick}>
          <CircleHelpIcon className="size-4" />
          <span className="sr-only">Help</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Help</TooltipContent>
    </Tooltip>
  );
}
