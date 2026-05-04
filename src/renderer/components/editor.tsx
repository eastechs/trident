import { Crepe, CrepeFeature } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";

export interface EditorHandle {
  getMarkdown: () => string;
}

interface MilkdownEditorWrapperProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  onReady?: (markdown: string) => void;
}

export const MilkdownEditorWrapper = forwardRef<
  EditorHandle,
  MilkdownEditorWrapperProps
>(function MilkdownEditorWrapper(
  { defaultValue = "", onChange, onReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onReadyRef.current = onReady;
  });

  useImperativeHandle(ref, () => ({
    getMarkdown: () => crepeRef.current?.getMarkdown() ?? "",
  }));

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue,
      features: {
        [CrepeFeature.TopBar]: true,
        [CrepeFeature.Toolbar]: true,
        [CrepeFeature.BlockEdit]: true,
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.Table]: true,
        [CrepeFeature.LinkTooltip]: true,
        [CrepeFeature.ListItem]: true,
        [CrepeFeature.ImageBlock]: true,
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.Cursor]: true,
        [CrepeFeature.Latex]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: "Start writing, or type / for commands...",
          mode: "block",
        },
      },
    });

    crepeRef.current = crepe;

    crepe.create().then(() => {
      if (cancelled) {
        crepe.destroy();
        return;
      }

      let lastMarkdown = crepe.getMarkdown();
      onReadyRef.current?.(lastMarkdown);

      interval = window.setInterval(() => {
        const currentMarkdown = crepe.getMarkdown();

        if (currentMarkdown !== lastMarkdown) {
          lastMarkdown = currentMarkdown;
          onChangeRef.current?.(currentMarkdown);
        }
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (interval !== undefined) clearInterval(interval);
      crepe.destroy();
      crepeRef.current = null;
    };
    // Note: defaultValue is intentionally NOT in deps — it's only the
    // initial value; live updates flow via onChange/onReady refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col [&_.ProseMirror]:flex-1 [&_.ProseMirror]:font-serif [&_.ProseMirror]:outline-none [&_.milkdown]:flex [&_.milkdown]:flex-1 [&_.milkdown]:flex-col [&_.milkdown]:border-none [&_.milkdown]:shadow-none [&_.milkdown]:outline-none [&_.milkdown-top-bar]:p-0! [&_.milkdown-top-bar_.top-bar-inner]:flex-nowrap [&_.milkdown-top-bar_.top-bar-inner]:overflow-x-auto [&_.milkdown-top-bar_.top-bar-inner]:px-3 [&_.milkdown-top-bar_.top-bar-inner:has(.top-bar-heading-dropdown)]:overflow-visible"
    />
  );
});
