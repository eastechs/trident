export default function Chat() {
  return (
    <>
      <h1>AI Chat</h1>
      <p className="lead">
        The chat view is the heart of Trident &mdash; two independent AI
        conversations running side by side, often with models from different
        providers, so you can compare takes, iterate on ideas, or divide the
        work without switching contexts.
      </p>

      <h2>Dual-Panel Layout</h2>
      <p>
        When you open a project, you see left and right chat panels. Each panel
        is a fully independent conversation with its own:
      </p>
      <ul>
        <li>Model selection from any configured provider connection</li>
        <li>Conversation history</li>
        <li>Document attachments</li>
        <li>Token usage tracking</li>
      </ul>
      <p>
        The panels are resizable &mdash; drag the divider to give more space to
        either side.
      </p>

      <h2>Choosing a Model</h2>
      <p>
        Each conversation has a model selector at the top. Click it to switch
        between any configured model. The model is locked to the conversation
        once you start chatting, so different conversations can use different
        models simultaneously.
      </p>
      <p>
        You need at least one provider connection configured in{" "}
        <em>Settings &gt; Providers</em> before you can chat.
      </p>

      <h2>Attaching Documents</h2>
      <p>
        Below the message input, you can select one or more documents to attach
        to the conversation. When attached, the model has full context of those
        documents and can reference or edit them in its responses. Attachments
        work across providers &mdash; you can attach a document originally
        drafted by one model to a conversation with another.
      </p>

      <h2>What the Model Can Do</h2>
      <p>
        Every model you chat with has access to the same set of project tools,
        regardless of provider:
      </p>
      <ul>
        <li>
          <strong>Read and edit attached documents</strong> &mdash; the model
          sees the full content and can rewrite, extend, or fix anything
          you&apos;ve attached to the conversation,{" "}
          <em>including documents that a different model originally wrote</em>.
          This is how models end up collaborating on the same piece of work:
          draft with one, then attach and hand off to another for review or
          edits.
        </li>
        <li>
          <strong>Create new documents</strong> &mdash; ask the model to draft
          something and it lands in the project alongside your own documents,
          ready to attach to a later conversation with any model.
        </li>
        <li>
          <strong>Generate images</strong> &mdash; ask any model for an image
          and it opens a picker inline so you choose which image model to use
          (OpenAI&apos;s GPT Image family or Google&apos;s Nano Banana / Gemini
          models), along with dimensions and quality. The finished image is
          saved to the project gallery.
        </li>
        <li>
          <strong>Read your workspace directory</strong> &mdash; if you set one
          when you created the project, the model can list, search, and read
          files inside it (read-only &mdash; it can&apos;t write back to the
          workspace).
        </li>
      </ul>

      <h2>Conversations</h2>
      <p>
        Each panel can have multiple conversations. Click the conversation
        history sidebar to switch between them or create a new one.
        Conversations track:
      </p>
      <ul>
        <li>
          Title (auto-generated from the first message, or manually renamed)
        </li>
        <li>Message count</li>
        <li>Which model was used</li>
        <li>Last message timestamp</li>
      </ul>
      <p>Right-click a conversation to rename or delete it.</p>

      <h2>Streaming Responses</h2>
      <p>
        AI responses stream in real time as the model generates them.
        You&apos;ll see a token usage indicator showing how much of the
        model&apos;s context window has been used, along with any context
        caching information.
      </p>

      <h2>Initial Prompt</h2>
      <p>
        If your project has an initial prompt configured, it will be
        automatically sent to both chat panels the first time you open the
        project. This is useful for establishing context or giving the AI
        standing instructions.
      </p>
    </>
  );
}
