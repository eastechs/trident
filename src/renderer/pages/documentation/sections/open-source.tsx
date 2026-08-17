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
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noreferrer"
        >
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

      <h2>Your data stays on your machine</h2>
      <p>
        Trident has no accounts, no telemetry, and no analytics. Your projects,
        documents, images, and conversations are stored locally. API keys are
        encrypted with your operating system&rsquo;s keychain and are only ever
        sent to the AI provider they belong to.
      </p>
      <p>Apart from the AI providers you configure, Trident connects to:</p>
      <table>
        <thead>
          <tr>
            <th>Destination</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GitHub Releases</td>
            <td>Checking for app updates on launch and every four hours</td>
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
        None of these requests carry your content, your keys, or an identifier
        for you.
      </p>

      <h2>Third-party software</h2>
      <p>
        Trident builds on open source work by others. Full attribution for the
        components and fonts bundled into the app is in{" "}
        <a
          href="https://github.com/eastechs/trident/blob/main/CREDITS.md"
          target="_blank"
          rel="noreferrer"
        >
          CREDITS.md
        </a>
        , and every dependency&rsquo;s license ships inside its own package.
      </p>

      <h2>Contributing</h2>
      <p>
        Bug reports, feature requests, and pull requests are welcome on GitHub.
        Contributors are asked to sign a Contributor License Agreement so that
        Eastechs, LLC can offer commercial licenses alongside the AGPL release;
        every contribution also remains available under the AGPL, permanently.
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
