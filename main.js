async function main() {
  // Modules to control application life and create native browser window
  const { app, BrowserWindow, ipcMain } = require("electron");
  const isDevelopment = require("electron-is-dev");
  const { autoUpdater } = require("electron-updater");

  async function createMainWindow() {
    // Create the browser window.
    const window = new BrowserWindow({
      width: 1280,
      height: 720,
      title: "Next Generation Tracker",
      webPreferences: {
        nodeIntegration: true,
      },
      minWidth: 800,
      minHeight: 600,
      icon: "images/logo.ico",
    });

    await new Promise((resolve, reject) => {
      // resolve when when 'did-finish-load' has been fired
      window.webContents.once("did-finish-load", resolve);

      // or reject if it was closed before then
      window.once("closed", () =>
        reject(new Error("Window closed prematurely."))
      );

      // initiate the loading
      window.loadFile(`${__dirname}/index.html`);
    });

    return window;
  }

  // 'ready' will be fired when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  await new Promise((resolve) => app.once("ready", resolve));

  // exit when all windows are closed and this promise is resolved
  const terminationPromise = new Promise((resolve) =>
    app.once("window-all-closed", resolve)
  );

  // we expect 'rendererReady' notification from Renderer
  const rendererPromise = new Promise((resolve) =>
    ipcMain.once("rendererReady", resolve)
  );

  // initiate creating the main window
  const mainWindowPromise = createMainWindow();

  // await both the window to have loaded
  // and 'rendererReady' notification to have been fired,
  // while observing premature termination
  await Promise.race([
    Promise.all([rendererPromise, mainWindowPromise]),
    terminationPromise.finally(() => {
      throw new Error("All windows closed prematurely.");
    }),
  ]);

  // keep the mainWindow reference
  const mainWindow = await mainWindowPromise;

  autoUpdater.on("error", error => {
    console.error(error);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((reason) => {
    throw new Error(reason);
  });

  autoUpdater.on("update-available", () => {
    mainWindow.webContents.send("update_available");
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update_downloaded");
  });

  // notify the Renderer that Main is ready
  mainWindow.webContents.send("mainReady");

  // from here we can do anything we want

  //
  // Open the DevTools if desired
  //mainWindow.webContents.openDevTools();
  //mainWindow.maximize();
  //

  ipcMain.once("restart", () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on("restart_app", () => {
    autoUpdater.quitAndInstall();
  });

  // awaiting terminationPromise here keeps the mainWindow object alive
  await terminationPromise;

  app.exit(0);
}

main().catch((error) => {
  console.log(error);
  process.exit(1);
});
