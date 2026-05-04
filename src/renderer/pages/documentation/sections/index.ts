import {
  BookOpenIcon,
  FolderIcon,
  MessageSquareIcon,
  FileTextIcon,
  ImageIcon,
  Settings2Icon,
  KeyboardIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import Chat from "./chat";
import Documents from "./documents";
import Gallery from "./gallery";
import GettingStarted from "./getting-started";
import KeyboardShortcuts from "./keyboard-shortcuts";
import Projects from "./projects";
import Settings from "./settings";

export interface DocSection {
  slug: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
}

export const SECTIONS: DocSection[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    icon: BookOpenIcon,
    component: GettingStarted,
  },
  {
    slug: "projects",
    title: "Projects",
    icon: FolderIcon,
    component: Projects,
  },
  { slug: "chat", title: "AI Chat", icon: MessageSquareIcon, component: Chat },
  {
    slug: "documents",
    title: "Documents",
    icon: FileTextIcon,
    component: Documents,
  },
  { slug: "gallery", title: "Gallery", icon: ImageIcon, component: Gallery },
  {
    slug: "settings",
    title: "Settings",
    icon: Settings2Icon,
    component: Settings,
  },
  {
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    icon: KeyboardIcon,
    component: KeyboardShortcuts,
  },
];
