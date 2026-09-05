import { useSearchParams } from "react-router-dom";
import type { CSSProperties } from "react";

import { useDocumentTitle } from "@/hooks/use-document-title";
import appIcon from "../../images/app-icon.png";

const dragStyle = { WebkitAppRegion: "drag" } as unknown as CSSProperties;
// The whole window is a drag region, which would swallow clicks on the links
// in the legal notice below.
const noDragStyle = { WebkitAppRegion: "no-drag" } as unknown as CSSProperties;

export default function About() {
  useDocumentTitle("About Trident");
  const [searchParams] = useSearchParams();
  const version = searchParams.get("version") ?? "0.0.0";
  const year = new Date().getFullYear();

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-white dark:bg-neutral-950"
      style={dragStyle}
    >
      <div className="bg-primary/10 dark:bg-primary/20 pointer-events-none absolute top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl" />

      <div className="animate-in fade-in relative z-10 flex flex-1 flex-col items-center px-10 pt-20 pb-9 duration-500">
        <div className="animate-in fade-in zoom-in-95 relative mb-7 duration-700">
          <div className="bg-primary/25 dark:bg-primary/40 absolute -inset-5 rounded-[30%] blur-2xl" />
          <img
            src={appIcon}
            alt="Trident"
            className="relative size-20 rounded-[22%] shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.2),_0_4px_10px_-4px_rgb(0_0_0_/_0.12)] dark:shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.65),_0_4px_10px_-4px_rgb(0_0_0_/_0.5)]"
          />
        </div>

        <h1
          className="text-foreground text-[34px] leading-none font-semibold"
          style={{ letterSpacing: "-0.025em" }}
        >
          Trident
        </h1>

        <p
          className="text-muted-foreground mt-3.5 text-[10px] font-medium uppercase"
          style={{ letterSpacing: "0.26em" }}
        >
          Multi&#8209;model&nbsp;&nbsp;workspace
        </p>

        <div className="bg-primary/50 mt-7 h-px w-10" />

        <div className="text-foreground/75 mt-6 font-mono text-[12px] tabular-nums">
          Version {version}
        </div>

        <div
          className="mt-auto flex flex-col items-center gap-1.5 text-center"
          style={noDragStyle}
        >
          <p className="text-muted-foreground/75 text-[10.5px]">
            © {year} Eastechs, LLC
          </p>
          <p className="text-muted-foreground/75 text-[10.5px]">
            Free software under{" "}
            <a
              href="/legal/LICENSE.txt"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground/80 underline underline-offset-2"
            >
              AGPL&#8209;3.0
            </a>
            . Comes with no warranty.
          </p>
          <p className="text-muted-foreground/75 text-[10.5px]">
            <a
              href={`https://github.com/eastechs/trident/tree/v${version}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground/80 underline underline-offset-2"
            >
              Source code
            </a>
            {" · "}
            <a
              href="/legal/THIRD-PARTY-NOTICES.txt"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground/80 underline underline-offset-2"
            >
              Licenses
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
