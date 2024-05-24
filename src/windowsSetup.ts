import * as ws from "windows-shortcuts";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { app, ipcMain } from "electron";
import { exec } from "child_process";

const makeShortcut = async (
    shortcutToCreateLocation: string,
    latestDownloadedAppLocation: string
) => {
    await ws.create(
        shortcutToCreateLocation,
        {
            target: latestDownloadedAppLocation,
            args: '💀 "☠️"',
            runStyle: ws.MIN,
            desc: "Does cool stuff.",
        },
        function (err) {
            if (err) {
                poorDebug(err);
                return;
            } else {
                poorDebug("-> Shortcut created!");
                return;
            }
        }
    );
};

const downloadLatestApp = async (
    latestAppDownloadUrl: string,
    destination: string
) => {
    return fetch(latestAppDownloadUrl)
        .then((response) => {
            if (!response.ok) throw new Error(`Failed to fetch ${response}`);

            const writeStream = fs.createWriteStream(destination);

            if (response.body)
                Readable.fromWeb(response.body).pipe(writeStream);

            writeStream.on("data", () => {
                poorDebug("-> -"); // FIXME: Not Working
            });
            writeStream.on("finish", () => {
                poorDebug("-> Download completed.");
            });
            writeStream.on("error", (err) => {
                poorDebug(`-> Download failed: ${err.message}`);
            });
        })
        .catch((error) => {
            poorDebug(`-> Download failed:: ${error.message}`);
        });
};

export const getCurrentAppVersion = async () => {
    return app.getVersion();
};

type ReleaseInfoType = {
    url: string;
    version: string;
};
const resolveLatestRelease = async (
    latestReleaseInfoUrl: string,
    currentVersion: string
): Promise<ReleaseInfoType | null> => {
    const result = await fetch(latestReleaseInfoUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    "Network response was not ok " + response.statusText
                );
            }
            return response.json() as Promise<ReleaseInfoType>;
        })
        .then((data) => {
            poorDebug("-> Data:", data);

            if (data.version != currentVersion) {
                return data as ReleaseInfoType;
            }
            return null;
        })
        .catch((error) => {
            poorDebug("-> Fetch error:", error);
            return null;
        });

    return result;
};

const resolveDefaultLocoFolder = async (defaultLocoFolderPath: string) => {
    await fs.access(defaultLocoFolderPath, (error) => {
        if (error) {
            fs.mkdir(defaultLocoFolderPath, { recursive: true }, (err) => {
                if (err) {
                    poorDebug(`-> Failed to create folder: ${err.message}`);
                } else {
                    poorDebug("-> Folder created successfully");
                }
            });
        } else {
            poorDebug("-> Folder already exists");
        }
    });
};

function fileExists(filePath: string) {
    return fs.existsSync(filePath);
}

const executeNewVersion = (executablePath: string) => {
    exec(`${executablePath}`, (error, stdout, stderr) => {
        if (error) {
            poorDebug(`-> Error executing latest version: ${error}`);
            return false;
        }
        poorDebug(`-> New .exe file executed.`);
        poorDebug(`-> Closing self.`);

        return true;
    });
};

export async function windowsSetup(): Promise<{ persist: boolean }> {
    const latestReleaseInfoUrl = "http://192.168.0.101:8080/windows.json"; // TODO:: Fix This
    const defaultLocoFolderPath = "C:\\Loco";
    const startupFolderLocation =
        "%APPDATA%/Microsoft/Windows/Start Menu/Programs/Startup";
    const shortcutToCreateLocation = path.join(
        startupFolderLocation,
        "loco.lnk"
    );

    const currentVersion = await getCurrentAppVersion();
    const latestRelease = await resolveLatestRelease(
        latestReleaseInfoUrl,
        currentVersion
    );

    if (latestRelease) {
        await resolveDefaultLocoFolder(defaultLocoFolderPath);

        const latestReleaseDestination = path.join(
            defaultLocoFolderPath,
            `loco ${latestRelease.version}.exe`
        );

        const isLatestAlreadyExists = await fileExists(
            latestReleaseDestination
        );

        if (!isLatestAlreadyExists) {
            await downloadLatestApp(
                latestRelease.url,
                latestReleaseDestination
            );

            await makeShortcut(
                shortcutToCreateLocation,
                latestReleaseDestination
            );

            // TODO:: delete unnecessary versions
        } else {
            poorDebug("-> opened the wrong version.");
        }

        const newVersionExecutableLocation = path.join(
            defaultLocoFolderPath,
            `"loco ${latestRelease.version}.exe"`
        );
        executeNewVersion(newVersionExecutableLocation);

        return { persist: false };
    } else {
        poorDebug("-> No latest release. We are good to go.");
    }

    return { persist: true };
}

const poorDebug = async (...args: any[]) => {
    args.forEach((arg) => {
        console.log(arg);
        fetch(`http://localhost:3000/print?message=${arg}`);
    });
};

// ! # check version
// ! # download new version
// ! # move new version to appropriate location
// ! # make a shortcut
// ! # move shortcut to startup location
// ! # start new version
// ! # close self
// ! # delete unnecessary versions
