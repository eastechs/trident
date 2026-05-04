export default function GettingStarted() {
  return (
    <>
      <h1>Getting Started</h1>
      <p className="lead">
        Trident is a collaborative workspace for working on projects with
        multiple AI models. Bring together models from Anthropic, OpenAI, and
        Google &mdash; each thinks and performs a little differently &mdash; and
        build up a shared set of documents and images alongside them.
      </p>

      <h2>Quick Start</h2>
      <ol>
        <li>
          <strong>Add an API key</strong> &mdash; Open{" "}
          <em>Settings &gt; Providers</em> and enter at least one API key
          (Anthropic, OpenAI, or Google Gemini). Keys are encrypted and stored
          locally on your device.
        </li>
        <li>
          <strong>Create a project</strong> &mdash; From the home screen, click{" "}
          <em>New Project</em>. Give it a name, an optional description, and
          optionally choose a workspace directory on disk.
        </li>
        <li>
          <strong>Start chatting</strong> &mdash; Open your project to land in
          the dual-panel chat view. Choose a model, type a message, and the AI
          will respond in real time.
        </li>
        <li>
          <strong>Build up the project&apos;s assets</strong> &mdash; Create
          documents yourself with <kbd>Cmd+N</kbd> (or the{" "}
          <em>File &gt; New Document</em> menu), or ask any model to draft one
          for you. Ask a model for an image and it&apos;ll open a picker so you
          can choose which image model to use. Everything lands in the same
          project.
        </li>
      </ol>

      <h2>Overview</h2>
      <p>
        A Trident project is a shared workspace between you and the models you
        choose to work with. The main project view runs two chat panels side by
        side so you can drive two models at once &mdash; often from different
        providers &mdash; to compare takes, divide the work, or get a second
        opinion without switching context.
      </p>
      <p>
        Each project has two kinds of assets: documents and images. Both you and
        any AI model can create them, and every model in the project sees the
        same gallery and can read or edit documents you attach to a conversation
        &mdash; <em>including documents that another model originally wrote</em>
        . This is the core of collaboration in Trident: one model can draft a
        chapter, a plan, or a spec, and you can hand it to a different model
        (often from a different provider) for review, editing, or a second take.
        Documents are written in Markdown and saved automatically, so attaching
        one to chat gives the receiving model full context while you keep
        working.
      </p>

      <h2>Your Data</h2>
      <p>
        All Trident files &mdash; projects, documents, and images &mdash; are
        stored locally on your computer in a <code>Trident</code> folder in your
        home directory (<code>~/Trident/</code>). Nothing is uploaded to the
        cloud. API keys are encrypted and stored on-device as well.
      </p>

      <h2>Supported AI Providers</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Models</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Anthropic</td>
            <td>Claude Opus, Sonnet, Haiku</td>
          </tr>
          <tr>
            <td>OpenAI</td>
            <td>GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano</td>
          </tr>
          <tr>
            <td>Google Gemini</td>
            <td>Gemini 3.1 Pro, Gemini 3 Flash</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
