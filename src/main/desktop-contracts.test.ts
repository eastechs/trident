import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");

// Execute the real main-process modules with OS boundaries replaced. No app,
// user settings, provider requests, keychain prompts, or timers are started.
function load(
  relative: string,
  mocks: Record<string, any> = {},
  globals: Record<string, any> = {},
): Record<string, any> {
  const filename = path.join(directory, relative);
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith(".")) {
        return load(
          path.join(path.dirname(relative), id.replace(/\.js$/, ".ts")),
          mocks,
          globals,
        );
      }
      return nativeRequire(id);
    },
    __dirname: path.join(root, "dist/main", path.dirname(relative)),
    Buffer,
    URL,
    console,
    process: { ...process, platform: "darwin", arch: "arm64" },
    ...globals,
  });
  return module.exports;
}

test("preload keeps authentication in IPC and detaches event subscriptions", async () => {
  const ipc = new EventEmitter() as EventEmitter & {
    invoke: (channel: string) => Promise<unknown>;
    send: () => void;
  };
  const calls: string[] = [];
  ipc.invoke = async (channel) => {
    calls.push(channel);
    return channel === "get-server-auth" ? "launch-token" : false;
  };
  ipc.send = () => {};
  let api: Record<string, any> = {};
  load("preload.ts", {
    electron: {
      ipcRenderer: ipc,
      contextBridge: {
        exposeInMainWorld: (name: string, value: Record<string, any>) => {
          assert.equal(name, "electronAPI");
          api = value;
        },
      },
    },
  });
  assert.equal(await api.getServerAuth(), "launch-token");
  assert.equal(await api.getUpdateReady(), false);
  assert.deepEqual(calls, ["get-server-auth", "get-update-ready"]);
  assert.equal(api.getApiKey, undefined);
  let received = "";
  const unsubscribe = api.onMenuAction((action: string) => {
    received = action;
  });
  ipc.emit("menu-action", {}, "save");
  assert.equal(received, "save");
  unsubscribe();
  ipc.emit("menu-action", {}, "delete");
  assert.equal(received, "save");
  assert.equal(ipc.listenerCount("menu-action"), 0);
});

test("local API rejects missing and incorrect authentication tokens", () => {
  const auth = load("auth.ts");
  const token = auth.getServerAuth();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, load("auth.ts").getServerAuth());
  for (const value of [undefined, "wrong-token", token]) {
    let status = 200;
    let passed = false;
    const response = {
      status: (code: number) => {
        status = code;
        return response;
      },
      json: () => {},
    };
    auth.requireServerAuth({ header: () => value }, response, () => {
      passed = true;
    });
    assert.equal(passed, value === token);
    assert.equal(status, value === token ? 200 : 401);
  }
});

test("credential persistence uses safeStorage and refuses unavailable encryption", async () => {
  const values = new Map<string, any>();
  let available = true;
  let decryptions = 0;
  const settings = load("settings.ts", {
    electron: {
      safeStorage: {
        isEncryptionAvailable: () => available,
        encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
        decryptString: (value: Buffer) => {
          decryptions++;
          return value.toString().slice(10);
        },
      },
    },
    "electron-store": {
      __esModule: true,
      default: class {
        constructor({ defaults }: { defaults: Record<string, any> }) {
          for (const [key, value] of Object.entries(defaults))
            values.set(key, structuredClone(value));
        }
        get(key: string) {
          return values.get(key);
        }
        set(key: string, value: unknown) {
          values.set(key, value);
        }
      },
    },
  });
  await settings.initSettings();
  settings.setApiKey("openai", "fixture-credential");
  assert.notEqual(values.get("apiKeys").openai, "fixture-credential");
  assert.equal(settings.getConfiguredProviders().openai, true);
  assert.equal(decryptions, 0);
  assert.equal(settings.getApiKey("openai"), "fixture-credential");
  available = false;
  assert.throws(
    () => settings.setApiKey("openai", "replacement"),
    /encryption is not available/,
  );
  assert.equal(settings.getApiKey("openai"), "fixture-credential");
});

test("secondary windows use the built preload and keep external navigation out of the app", () => {
  const created: any[] = [];
  const external: string[] = [];
  class Window extends EventEmitter {
    options: any;
    url = "";
    focused = false;
    open: any;
    webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: (handler: any) => {
        this.open = handler;
      },
    });
    constructor(options: any) {
      super();
      this.options = options;
      created.push(this);
    }
    loadURL(url: string) {
      this.url = url;
    }
    setMenu() {}
    isDestroyed() {
      return false;
    }
    focus() {
      this.focused = true;
    }
  }
  const windows = load("native/windows.ts", {
    electron: {
      app: { isPackaged: true, getVersion: () => "0.5.0" },
      BrowserWindow: Window,
      shell: {
        openExternal: async (url: string) => {
          external.push(url);
        },
      },
    },
  });
  windows.openDocumentationWindow();
  windows.openAboutWindow();
  windows.openDocumentationWindow();
  assert.equal(created.length, 2);
  assert.equal(created[0].focused, true);
  for (const win of created) {
    assert.equal(
      win.options.webPreferences.preload,
      path.join(root, "dist/main/preload.js"),
    );
    assert.equal(win.options.webPreferences.contextIsolation, true);
    assert.equal(win.options.webPreferences.nodeIntegration, false);
    assert.equal(
      win.open({ url: "http://localhost:19274/legal/LICENSE.txt" }).action,
      "allow",
    );
    assert.equal(win.open({ url: "javascript:alert(1)" }).action, "deny");
  }
  let prevented = false;
  created[0].webContents.emit(
    "will-navigate",
    {
      preventDefault: () => {
        prevented = true;
      },
    },
    "https://example.com",
  );
  assert.equal(prevented, true);
  assert.deepEqual(external, ["https://example.com"]);
});

test("native icons resolve in development and in the packaged resources", () => {
  const app = { isPackaged: false };
  const icons = load(
    "native/app-icon.ts",
    { electron: { app } },
    {
      process: {
        resourcesPath: "/Applications/Trident.app/Contents/Resources",
      },
    },
  );
  assert.equal(
    icons.appIconPath(),
    path.join(root, "resources/images/app-icon.png"),
  );
  app.isPackaged = true;
  assert.equal(
    icons.appIconPath(),
    "/Applications/Trident.app/Contents/Resources/images/app-icon.png",
  );
});

test("updater stages downloads and only installs a completed update", async () => {
  const ipc = new Map<string, (...args: any[]) => any>();
  let installs = 0;
  let checks = 0;
  let interval = 0;
  const sent: string[] = [];
  const updater = Object.assign(new EventEmitter(), {
    checkForUpdates: async () => {
      checks++;
      return null;
    },
    quitAndInstall: () => {
      installs++;
    },
    autoDownload: false,
    autoInstallOnAppQuit: false,
  });
  const api = load(
    "native/updater.ts",
    {
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: async () => {} },
        ipcMain: {
          handle: (name: string, handler: (...args: any[]) => any) =>
            ipc.set(name, handler),
        },
      },
      "electron-updater": { autoUpdater: updater },
      "./windows.js": {
        getMainWindow: () => ({
          webContents: { send: (channel: string) => sent.push(channel) },
        }),
      },
    },
    {
      setInterval: (_callback: unknown, delay: number) => {
        interval = delay;
      },
    },
  );
  api.registerUpdaterIpc();
  ipc.get("install-update")!();
  assert.equal(installs, 0);
  api.initAutoUpdater();
  await Promise.resolve();
  assert.equal(checks, 1);
  assert.equal(interval, 4 * 60 * 60 * 1000);
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, true);
  updater.emit("update-downloaded");
  assert.equal(ipc.get("get-update-ready")!(), true);
  assert.deepEqual(sent, ["update-ready"]);
  ipc.get("install-update")!();
  assert.equal(installs, 1);
});
