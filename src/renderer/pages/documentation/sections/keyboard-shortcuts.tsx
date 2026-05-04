export default function KeyboardShortcuts() {
  return (
    <>
      <h1>Keyboard Shortcuts</h1>
      <p className="lead">
        Quick reference for all keyboard shortcuts available in Trident.
      </p>

      <h2>Documents</h2>
      <table>
        <thead>
          <tr>
            <th>Shortcut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <kbd>Cmd+N</kbd>
            </td>
            <td>Create a new document</td>
          </tr>
          <tr>
            <td>
              <kbd>Cmd+S</kbd>
            </td>
            <td>Save the current document</td>
          </tr>
          <tr>
            <td>
              <kbd>Cmd+P</kbd>
            </td>
            <td>Print the current document</td>
          </tr>
        </tbody>
      </table>

      <h2>Markdown Editing</h2>
      <p>The Markdown editor supports standard text editing shortcuts:</p>
      <table>
        <thead>
          <tr>
            <th>Shortcut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <kbd>Cmd+B</kbd>
            </td>
            <td>Bold</td>
          </tr>
          <tr>
            <td>
              <kbd>Cmd+I</kbd>
            </td>
            <td>Italic</td>
          </tr>
          <tr>
            <td>
              <kbd>Cmd+Z</kbd>
            </td>
            <td>Undo</td>
          </tr>
          <tr>
            <td>
              <kbd>Cmd+Shift+Z</kbd>
            </td>
            <td>Redo</td>
          </tr>
        </tbody>
      </table>

      <p>
        <em>
          Note: On Windows and Linux, replace <kbd>Cmd</kbd> with{" "}
          <kbd>Ctrl</kbd> for all shortcuts above.
        </em>
      </p>
    </>
  );
}
