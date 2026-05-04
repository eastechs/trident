export default function Settings() {
  return (
    <>
      <h1>Settings</h1>
      <p className="lead">
        Configure your Trident preferences, API keys, and AI agent behavior from
        the Settings screen.
      </p>

      <h2>Preferences</h2>

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

      <h2>Providers (API Keys)</h2>
      <p>
        Trident requires at least one AI provider API key to function. You can
        configure keys for:
      </p>
      <ul>
        <li>
          <strong>Anthropic</strong> &mdash; for Claude models (Opus, Sonnet,
          Haiku)
        </li>
        <li>
          <strong>OpenAI</strong> &mdash; for GPT models
        </li>
        <li>
          <strong>Google Gemini</strong> &mdash; for Gemini models
        </li>
      </ul>
      <p>
        All API keys are <strong>encrypted locally</strong> on your device. They
        are never sent anywhere except directly to the respective AI provider
        when making API calls.
      </p>
      <p>
        A <em>Configured</em> badge appears next to each provider that has a
        valid key. Use the eye icon to toggle key visibility, or the Clear
        button to remove a key.
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
