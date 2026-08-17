export default function GettingStarted() {
  return (
    <>
      <h1>Getting Started</h1>
      <p className="lead">
        Trident is a collaborative workspace for working on projects with
        multiple AI models. Connect directly to Anthropic, OpenAI, or Google, or
        use models deployed through Amazon Bedrock, Google Vertex AI, and Azure
        OpenAI. Each thinks and performs a little differently, while your
        documents and images stay together in one workspace.
      </p>

      <h2>Quick Start</h2>
      <ol>
        <li>
          <strong>Connect a provider</strong> &mdash; Open{" "}
          <em>Settings &gt; Providers</em> and configure at least one direct API
          or cloud platform. Secrets are encrypted and stored locally on your
          device.
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
        home directory (<code>~/Trident/</code>). Trident does not sync that
        library to its own cloud service. Prompts and attached content are sent
        only when needed to the AI connection you choose, and provider secrets
        are encrypted on-device.
      </p>

      <h2>Supported AI Providers</h2>
      <p>Trident connects in two ways:</p>
      <ul>
        <li>
          <strong>Direct APIs</strong> &mdash; Anthropic, OpenAI, and Google
          Gemini, using your own API key for each. Trident lists whatever
          chat-capable models your key has access to, so new releases appear as
          soon as the provider offers them.
        </li>
        <li>
          <strong>Cloud platforms</strong> &mdash; Amazon Bedrock, Google Vertex
          AI, and Azure OpenAI, using the models, inference profiles, and
          deployments already provisioned in your organization&apos;s account.
          You choose which of them Trident should offer when you set up the
          connection.
        </li>
      </ul>
      <p>
        Trident works out what each model supports &mdash; extended thinking,
        image input, context size &mdash; and adapts the chat controls to match.
      </p>
    </>
  );
}
