import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Projects() {
  return (
    <>
      <h1>Projects</h1>
      <p className="lead">
        Projects are the top-level workspace in Trident. Each project is a
        shared container for you and the AI models you&apos;re working with
        &mdash; grouping together conversations and the assets those
        conversations produce (documents and images) in one place.
      </p>

      <h2>The Projects Dashboard</h2>
      <p>
        The home screen shows all your projects in a grid. Each project card
        displays:
      </p>
      <ul>
        <li>The project name and description</li>
        <li>Document count and image count</li>
        <li>Icons for which AI providers have been used in the project</li>
      </ul>

      <h2>Creating a Project</h2>
      <p>
        Click the <strong>New Project</strong> button to open the create dialog.
        Fill in:
      </p>
      <ul>
        <li>
          <strong>Name</strong> (required) &mdash; a short name for the project.
        </li>
        <li>
          <strong>Description</strong> (optional) &mdash; a brief summary of
          what the project is about.
        </li>
        <li>
          <strong>Workspace Directory</strong> (optional) &mdash; click{" "}
          <em>Select Directory</em> to choose a folder on disk. The native file
          picker will open so you can browse your filesystem.
        </li>
        <li>
          <strong>Initial Prompt</strong> (optional) &mdash; a message that is
          automatically sent to both chat panels when you first open the
          project. Useful for setting context or instructions for the AI.
        </li>
      </ul>
      <p>
        All project files are stored locally on your computer in{" "}
        <code>~/Trident/Projects/</code>. Each project gets its own folder
        containing its documents and images. Nothing is uploaded to the cloud.
      </p>

      <Alert className="my-6">
        <ShieldCheck />
        <AlertTitle>Workspace Directory is read-only</AlertTitle>
        <AlertDescription>
          The AI is granted <strong>read-only</strong> access to the workspace
          directory and can list, search, and read files within it, but cannot
          create, modify, or delete anything inside.
        </AlertDescription>
      </Alert>

      <h2>How Files Are Organized</h2>
      <p>
        Inside a project folder, documents are split into per-model
        subdirectories. Every AI model you chat with gets its own documents
        folder, and can only discover the documents it created there. Your own
        documents live in a dedicated <code>user</code> folder. Images are kept
        in a single shared <code>images</code> folder regardless of which model
        generated them.
      </p>
      <p>
        For a project named &ldquo;Novel Ideas&rdquo;, the layout looks like
        this:
      </p>
      <pre>
        <code>{`~/Trident/
└── Projects/
    └── novel-ideas/
        ├── project.json
        ├── documents/
        │   ├── user/
        │   │   └── outline.md
        │   ├── claude-sonnet-4-5/
        │   │   ├── chapter-one.md
        │   │   └── character-notes.md
        │   └── gpt-5/
        │       └── world-building.md
        └── images/
            ├── cover-concept.png
            └── map-sketch.png`}</code>
      </pre>
      <p>
        The per-model folders describe <em>where things live on disk</em>, not
        who&apos;s allowed to touch what. When you attach a document to a
        conversation, the model you&apos;re chatting with can read and edit it
        regardless of which folder it came from &mdash; including documents
        another model originally wrote. For example, if you attach{" "}
        <code>chapter-one.md</code> (created by <code>claude-sonnet-4-5</code>)
        to a conversation with <code>gpt-5</code>, <code>gpt-5</code> can edit
        it freely. The file stays in the <code>claude-sonnet-4-5</code> folder,
        and only the <code>last_edited_by</code> metadata changes to record the
        handoff. That&apos;s the mechanism behind multi-model collaboration on a
        single document.
      </p>

      <h2>Deleting a Project</h2>
      <p>
        Right-click a project card or use the delete option to remove a project.
        Depending on your preferences, the project will either be moved to the
        system Trash or permanently deleted. You can change this behavior in{" "}
        <em>Settings &gt; Preferences</em>.
      </p>

      <h2>Project Views</h2>
      <p>
        Once you open a project, the left sidebar provides navigation between
        the project&apos;s views:
      </p>
      <ul>
        <li>
          <strong>Chat</strong> &mdash; the main dual-panel AI chat with
          document and image management.
        </li>
        <li>
          <strong>Docs</strong> &mdash; a dedicated document editing interface
          without the chat panels.
        </li>
        <li>
          <strong>Gallery</strong> &mdash; a full-screen image viewer and
          manager.
        </li>
      </ul>
    </>
  );
}
