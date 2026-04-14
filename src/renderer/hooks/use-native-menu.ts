import { useEffect, useRef } from 'react';

interface NativeMenuActions {
    onNewDocument?: () => void;
    onSave?: () => void;
    onPrint?: () => void;
    onClose?: () => void;
    onDelete?: () => void;
}

/**
 * Opens a new window with the document content and triggers the print dialog.
 * The content comes from the ProseMirror editor DOM - this is the user's own
 * document content already rendered in the page, so innerHTML usage is safe
 * because it's cloning trusted DOM nodes the user already sees.
 */
export function printDocumentContent(title: string): void {
    const proseMirror = document.querySelector(
        '.flex-1:not(.hidden) .ProseMirror',
    );

    if (!proseMirror) {
        return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        return;
    }

    // Clone editor stylesheets for faithful rendering
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.cloneNode(true));

    const doc = printWindow.document;
    doc.title = title;

    for (const style of styles) {
        doc.head.appendChild(doc.importNode(style, true));
    }

    const printStyle = doc.createElement('style');
    printStyle.textContent = `
        body { margin: 0; padding: 0; }
        .milkdown { border: none !important; box-shadow: none !important; }
        .milkdown .ProseMirror { padding: 40px 60px !important; }
    `;
    doc.head.appendChild(printStyle);

    // Clone the actual DOM nodes (safe — these are already rendered in the page)
    const milkdown = doc.createElement('div');
    milkdown.className = 'milkdown';

    const pm = doc.createElement('div');
    pm.className = 'ProseMirror';
    // Deep-clone trusted editor DOM nodes rather than using innerHTML
    for (const child of Array.from(proseMirror.childNodes)) {
        pm.appendChild(doc.importNode(child, true));
    }

    milkdown.appendChild(pm);
    doc.body.appendChild(milkdown);

    printWindow.addEventListener('afterprint', () => printWindow.close());
    printWindow.print();
}

const ACTION_MAP: Record<string, keyof NativeMenuActions> = {
    'new-document': 'onNewDocument',
    save: 'onSave',
    print: 'onPrint',
    close: 'onClose',
    delete: 'onDelete',
};

export function useNativeMenu(actions: NativeMenuActions): void {
    const actionsRef = useRef(actions);

    useEffect(() => {
        actionsRef.current = actions;
    });

    useEffect(() => {
        // Listen for menu actions from Electron main process via preload bridge
        const api = (window as unknown as { electronAPI?: { onMenuAction: (cb: (action: string) => void) => void } }).electronAPI;
        if (!api) return;

        api.onMenuAction((action: string) => {
            const actionKey = ACTION_MAP[action];
            if (actionKey) {
                actionsRef.current[actionKey]?.();
            }
        });
    }, []);
}
