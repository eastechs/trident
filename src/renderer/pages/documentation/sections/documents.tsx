export default function Documents() {
  return (
    <>
      <h1>Documents</h1>
      <p className="lead">
        Documents are one of the two asset types a Trident project contains
        (alongside images). They&apos;re Markdown files that can be created by
        you <em>or</em> by any AI model you&apos;re working with, and every
        model in the project can read and edit any document you attach to a
        conversation &mdash; even ones that another model originally drafted.
      </p>
      <p>
        Each model has its own documents folder on disk (see the{" "}
        <em>Projects</em> section for the exact layout), but that&apos;s just
        how files are organized under the hood. In conversation, attached
        documents are shared freely across models.
      </p>

      <h2>Collaborating Across Models</h2>
      <p>
        Because any model can read and edit any attached document, Trident
        supports a multi-model workflow that&apos;s hard to do anywhere else:
        one model can draft a document, and then you can hand that same document
        to another model &mdash; often from a different provider &mdash; for
        review, critique, or further edits. A few ways this tends to play out:
      </p>
      <ul>
        <li>
          Ask one model to draft a chapter, then attach it to a conversation
          with another and ask for notes or a revision pass.
        </li>
        <li>
          Have one model outline a plan, then hand the outline to another to
          flesh out the details.
        </li>
        <li>
          Get two models to take turns editing the same document so their
          strengths compound instead of competing.
        </li>
      </ul>
      <p>
        The document stays in place on disk; only the{" "}
        <code>last_edited_by</code> metadata updates to record who made the most
        recent change.
      </p>

      <h2>Creating Documents</h2>
      <p>There are several ways to create a new document:</p>
      <ul>
        <li>
          Press <kbd>Cmd+N</kbd> (or <kbd>Ctrl+N</kbd> on Windows/Linux)
        </li>
        <li>
          Use the <em>File &gt; New Document</em> menu
        </li>
        <li>
          Click the <strong>+</strong> button in the document sidebar
        </li>
        <li>Ask the AI to create a document in a chat conversation</li>
      </ul>
      <p>
        New documents are automatically named &ldquo;Untitled 1&rdquo;,
        &ldquo;Untitled 2&rdquo;, etc. You can rename them at any time.
      </p>

      <h2>The Markdown Editor</h2>
      <p>
        Trident uses a rich Markdown editor powered by Milkdown. It supports
        standard Markdown syntax including headings, lists, code blocks, links,
        images, and more. The editor renders your Markdown in real time as you
        type.
      </p>

      <h2>Saving</h2>
      <ul>
        <li>
          <strong>Manual save</strong> &mdash; press <kbd>Cmd+S</kbd> or click
          the Save button. A status indicator shows &ldquo;Saving...&rdquo; then
          a checkmark when complete.
        </li>
        <li>
          <strong>Autosave</strong> &mdash; toggle autosave on to automatically
          save 2 seconds after you stop typing. The autosave toggle is in the
          editor toolbar.
        </li>
        <li>
          <strong>Revert</strong> &mdash; click Revert to discard unsaved
          changes and reload from disk.
        </li>
      </ul>
      <p>
        Unsaved changes are indicated by an asterisk (*) on the document tab.
      </p>

      <h2>Tabs</h2>
      <p>Open documents appear as tabs in the tab bar. You can:</p>
      <ul>
        <li>Click a tab to switch to that document</li>
        <li>Drag tabs to reorder them</li>
        <li>Right-click a tab to rename, close, or delete the document</li>
        <li>Close a tab with the X button</li>
      </ul>
      <p>Your open tabs are remembered between sessions.</p>

      <h2>Document Sidebar</h2>
      <p>
        The left sidebar shows all documents in the project, organized into a
        collapsible directory tree. You can:
      </p>
      <ul>
        <li>Click a document to open it in a new tab</li>
        <li>Right-click for options: Rename, Delete</li>
        <li>Rename inline by pressing Enter to confirm or Escape to cancel</li>
      </ul>

      <h2>Dedicated Docs View</h2>
      <p>
        The <strong>Docs</strong> view (accessible from the project sidebar)
        provides a focused document editing experience without the chat panels,
        giving you more screen space for writing.
      </p>

      <h2>Printing</h2>
      <p>
        Print the current document via <em>File &gt; Print</em> or{" "}
        <kbd>Cmd+P</kbd>. This opens a print preview window with your document
        styled for paper output.
      </p>
    </>
  );
}
