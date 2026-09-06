export default function Settings() {
  return (
    <>
      <h1>Settings</h1>
      <p className="lead">
        Configure your Trident preferences, AI provider connections, and agent
        behavior from the Settings screen.
      </p>

      <h2>Preferences</h2>

      <h3>Appearance</h3>
      <p>
        Choose <strong>System</strong>, <strong>Light</strong>, or{" "}
        <strong>Dark</strong> under Theme. System follows your device&apos;s
        appearance. Changes apply immediately across Trident and are saved for
        the next launch.
      </p>

      <h3>Notifications</h3>
      <p>
        Choose whether Trident sends desktop notifications when AI responses
        complete:
      </p>
      <ul>
        <li>
          <strong>All responses</strong> &mdash; get notified whenever the AI
          finishes generating a response.
        </li>
        <li>
          <strong>No notifications</strong> &mdash; disable all desktop
          notifications.
        </li>
      </ul>

      <h3>File Deletion</h3>
      <p>
        Control what happens when you delete documents, images, or projects:
      </p>
      <ul>
        <li>
          <strong>Move to Trash</strong> &mdash; deleted items go to your system
          Trash and can be recovered.
        </li>
        <li>
          <strong>Delete permanently</strong> &mdash; items are removed
          immediately and cannot be recovered.
        </li>
      </ul>

      <h2>Providers</h2>
      <p>
        Trident requires at least one AI provider connection to chat. Direct
        APIs use a provider key:
      </p>
      <ul>
        <li>
          <strong>Anthropic</strong>
        </li>
        <li>
          <strong>OpenAI</strong>
        </li>
        <li>
          <strong>Google Gemini</strong>
        </li>
      </ul>
      <p>
        Trident offers whatever chat-capable models the key has access to, so
        you don&apos;t need to update anything when a provider ships a new
        model.
      </p>
      <p>
        Cloud platforms let you use models and deployments already available in
        your organization:
      </p>
      <ul>
        <li>
          <strong>Amazon Bedrock</strong> &mdash; using AWS credentials, a
          credential chain, or a Bedrock API key
        </li>
        <li>
          <strong>Google Vertex AI</strong> &mdash; using Application Default
          Credentials, a service account, or an Express Mode API key
        </li>
        <li>
          <strong>Azure OpenAI</strong> &mdash; using an Azure endpoint, API
          key, and deployment names
        </li>
      </ul>
      <p>
        Cloud connections also need the model, inference-profile, or deployment
        IDs you want Trident to show. An optional base model ID helps Trident
        label capabilities and estimate usage when a deployment has a custom
        name. You can add or change a base model ID later without affecting
        conversations already using that model &mdash; a model is identified by
        its provider-facing ID.
      </p>
      <p>Two connection details are easy to get wrong:</p>
      <ul>
        <li>
          <strong>Vertex Express Mode keys</strong> reach Google&apos;s own
          models only. Vertex serves models from other publishers on separate
          endpoints that require a service account or Application Default
          Credentials, so Trident will tell you if a configured model can&apos;t
          be reached with the credentials you chose.
        </li>
        <li>
          <strong>Azure endpoints</strong> can be pasted exactly as the portal
          shows them &mdash; <code>*.openai.azure.com</code>,{" "}
          <code>*.cognitiveservices.azure.com</code>, or{" "}
          <code>*.services.ai.azure.com</code>. Trident adds the path segment
          Azure expects.
        </li>
      </ul>
      <p>
        Saving a connection tests it first, so a bad region, endpoint, or
        credential is reported before it is stored rather than at the moment you
        try to chat.
      </p>
      <p>
        API keys and credential material are <strong>encrypted locally</strong>{" "}
        on your device and are used only by Trident&apos;s local backend to
        authenticate requests. Non-secret connection details such as regions,
        endpoints, and model IDs are stored locally as settings.
      </p>
      <p>
        A <em>Configured</em> badge appears next to each provider that has a
        saved connection. Use <em>Edit</em> to replace its configuration or{" "}
        <em>Remove</em> to disconnect it.
      </p>

      <h2>Agents</h2>
      <p>
        The Agents tab lets you customize the AI agent&apos;s behavior by
        editing its system instructions. The Collaborator agent is the AI that
        runs inside every chat panel in Trident, so these instructions shape how{" "}
        <em>every</em> model you chat with behaves &mdash; regardless of
        provider.
      </p>
      <ul>
        <li>
          <strong>Agent selector</strong> &mdash; choose which agent to
          configure (currently the &ldquo;Collaborator&rdquo; agent).
        </li>
        <li>
          <strong>Instructions editor</strong> &mdash; a Markdown editor where
          you can write custom instructions that shape how the AI responds and
          behaves.
        </li>
        <li>
          <strong>Reset to Default</strong> &mdash; restore the original
          instructions if you&apos;ve made customizations.
        </li>
      </ul>
    </>
  );
}
