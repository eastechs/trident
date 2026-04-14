import { api_get, api_post, api_put, api_patch, api_delete } from '@/lib/api';
import { CircleHelpIcon } from 'lucide-react';

import { open as openDocumentation } from '@/actions/App/Http/Controllers/DocumentationController';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function HelpSidebarButton() {
    const handleClick = () => {
        api_post(openDocumentation.url());
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
