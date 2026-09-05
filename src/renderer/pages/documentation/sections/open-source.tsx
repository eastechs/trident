export default function OpenSource() {
  return (
    <>
      <h1>Open Source</h1>
      <p className="lead">
        Trident is free software. You can read every line of it, build it
        yourself, and verify exactly what it does with your data.
      </p>

      <h2>License</h2>
      <p>
        Trident is licensed under the{" "}
        <a href="/legal/LICENSE.txt" target="_blank" rel="noreferrer">
          GNU Affero General Public License, version 3
        </a>
        . You are free to use, study, modify, and redistribute it. If you
        distribute a modified version — or run one as a network service — that
        version must also be released under the AGPL.
      </p>
      <p>
        Trident comes with <strong>no warranty</strong>, to the extent permitted
        by law.
      </p>
      <p>
        The source code lives at{" "}
        <a
          href="https://github.com/eastechs/trident"
          target="_blank"
          rel="noreferrer"
        >
          github.com/eastechs/trident
        </a>
        .
      </p>
      <p>
        If the AGPL does not work for your organization, commercial licenses and
        support are available — contact{" "}
        <a href="mailto:licensing@eastechs.com">licensing@eastechs.com</a>.
      </p>

      <h2>Local storage and provider requests</h2>
      <p>
        Trident has no accounts, no telemetry, and no analytics. Your projects,
        documents, images, and conversations are stored locally. Chat and image
        requests send prompts, conversation context, and any included documents
        or images directly to the configured provider. Its account settings and
        terms govern provider-side processing and retention.
      </p>
      <p>
        Credentials are encrypted locally using the operating system&rsquo;s
        secure storage and kept out of the renderer. The main process uses keys
        or derived tokens to authenticate with providers and their identity
        services.
      </p>
      <p>
        <strong>Semantic indexing uses OpenAI.</strong> When enabled for a
        project with an OpenAI key configured, document saves and edits send
        text chunks to OpenAI for embeddings. Image indexing sends names and
        generation prompts. This happens independently of the chat provider
        selected in either panel. Disabling semantic indexing stops new
        automatic indexing; requests already in progress may finish. Semantic
        searches separately send the query to OpenAI, including searches over an
        existing index.
      </p>
      <p>Background requests include:</p>
      <table>
        <thead>
          <tr>
            <th>Destination</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GitHub Releases and its download hosts</td>
            <td>
              Checking for updates on launch and every four hours, and
              downloading new versions
            </td>
          </tr>
          <tr>
            <td>raw.githubusercontent.com</td>
            <td>
              Refreshing model pricing data so cost estimates stay accurate
            </td>
          </tr>
          <tr>
            <td>models.dev</td>
            <td>Provider logos shown in the model picker</td>
          </tr>
        </tbody>
      </table>
      <p>
        These background requests do not include workspace content or provider
        credentials. Their hosts receive ordinary network metadata, including
        your IP address and request headers. The updater also sends a locally
        generated, persistent installation ID with release metadata requests to
        support staged rollouts. Remote images in documents or model responses
        may contact their hosts, and external links open in your default
        browser.
      </p>

      <h2>Third-party software</h2>
      <p>
        Trident builds on open source work by others. Read the bundled{" "}
        <a href="/legal/CREDITS.txt" target="_blank" rel="noreferrer">
          credits
        </a>{" "}
        and{" "}
        <a
          href="/legal/THIRD-PARTY-NOTICES.txt"
          target="_blank"
          rel="noreferrer"
        >
          dependency license notices
        </a>
        . These documents are included with the app and are available offline.{" "}
        Additional{" "}
        <a
          href="/legal/LICENSES.chromium.html"
          target="_blank"
          rel="noreferrer"
        >
          Chromium notices
        </a>{" "}
        cover the browser engine bundled with Electron.
      </p>

      <h2>Contributing</h2>
      <p>
        External code contributions are currently closed, but we plan to welcome
        them in the near future. Bug reports and feature requests are welcome.
      </p>
      <p>
        Found a security issue? Please report it privately rather than opening a
        public issue — see{" "}
        <a
          href="https://github.com/eastechs/trident/blob/main/SECURITY.md"
          target="_blank"
          rel="noreferrer"
        >
          SECURITY.md
        </a>
        .
      </p>
    </>
  );
}
