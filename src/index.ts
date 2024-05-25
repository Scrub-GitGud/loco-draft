import { app, BrowserWindow } from "electron";
import { getCurrentAppVersion, windowsSetup } from "./windowsSetup.js";

async function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    const { persist } = await windowsSetup();
    if (!persist) {
        return app.quit();
    }

    const currentVersion = await getCurrentAppVersion();

    win.loadFile("index.html")
        .then(() => {
            win.webContents.send("msg", "One Piece is Real.");
            win.webContents.send("version", currentVersion);
            win.webContents.send("workingDir", app.getAppPath());
            win.webContents.send("runningDir", process.cwd());
        })
        .then(() => {
            win.show();
        });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
