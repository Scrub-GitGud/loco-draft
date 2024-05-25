import * as ws from "windows-shortcuts";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { app, ipcMain } from "electron";
import { exec } from "child_process";

const makeShortcut = async (
    shortcutToCreateLocation: string,
    mainAppLocation: string
) => {
    return new Promise((resolve, reject) => {
        ws.create(
            shortcutToCreateLocation,
            {
                target: mainAppLocation,
                args: '💀 "☠️"',
                runStyle: ws.MIN,
                desc: "Does cool stuff.",
            },
            function (err) {
                if (err) {
                    poorDebug("-> Shortcut creation failed!", err);
                    reject(true);
                    return;
                } else {
                    poorDebug("-> Shortcut created.");
                    resolve(true);
                }
            }
        );
    });
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

const getRunningPortableAppInfo = () => {
    const portableAppData = {
        executableFile: process.env.PORTABLE_EXECUTABLE_FILE,
        executableDir: process.env.PORTABLE_EXECUTABLE_DIR,
        executableName: process.env.PORTABLE_EXECUTABLE_APP_FILENAME,
    };

    if (
        !portableAppData.executableFile ||
        !portableAppData.executableDir ||
        !portableAppData.executableName
    ) {
        return null;
    }

    return portableAppData;
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

const fileExists = (filePath: string) => {
    return fs.existsSync(filePath);
};

const getMainExeFileNameFromPath = (filePath: string) => {
    const _filePath = filePath.replace("\\", "/");
    return path.basename(_filePath) ?? "loco.exe";
};

const copyFile = (source: string, destination: string) => {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);

        readStream.on("error", (err) => {
            reject(err);
        });

        writeStream.on("error", (err) => {
            reject(err);
        });

        writeStream.on("close", () => {
            resolve("File copied successfully!");
        });

        readStream.pipe(writeStream);
    });
};

const checkIsAnyVersionOfLocoInstalled = async (
    directoryPath: string,
    filePrefix: string
) => {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
                poorDebug("Default Loco path created");
                resolve(true);
            } else {
                poorDebug("Default Loco path exists.");
            }

            const files = fs.readdirSync(directoryPath);
            const matchingFiles = files.filter((file) =>
                file.startsWith(filePrefix)
            );

            if (matchingFiles.length > 0) {
                resolve(true);
                poorDebug("Matching files found:", matchingFiles);
            } else {
                resolve(false);
                poorDebug("No matching files found");
            }
        } catch (error) {
            poorDebug("-> Error: ", error);
            resolve(false);
        }
    });
};

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
    try {
        const latestReleaseInfoUrl = "http://192.168.0.105:8080/windows.json"; // TODO:: Fix This
        const defaultLocoFolderPath = "C:\\Loco";
        const startupFolderLocation =
            "%APPDATA%/Microsoft/Windows/Start Menu/Programs/Startup";
        const startMenuFolderLocation =
            "%APPDATA%/Microsoft/Windows/Start Menu/Programs";
        const desktopFolderLocation = "%USERPROFILE%/Desktop";
        const mainShortcutLocation = path.join(
            defaultLocoFolderPath,
            "loco.lnk"
        );

        const currentVersion = await getCurrentAppVersion();

        // ! Check if this is the first time
        const isAnyVersionOfLocoInstalled =
            await checkIsAnyVersionOfLocoInstalled(
                defaultLocoFolderPath,
                "loco"
            );

        // ! If first time?
        // !               -> copy to appropriate folder
        // !               -> make main shortcut
        // !               -> make 3 other shortcut (Startup, Start Menu, Desktop)
        if (!isAnyVersionOfLocoInstalled) {
            const runningPortableAppInfo = await getRunningPortableAppInfo();

            if (
                !runningPortableAppInfo ||
                !runningPortableAppInfo.executableFile
            )
                throw new Error(`Running portable app info not found!`);

            const fileName = getMainExeFileNameFromPath(
                runningPortableAppInfo.executableFile
            );

            const copyToLocation = path.join(defaultLocoFolderPath, fileName);

            await copyFile(
                runningPortableAppInfo.executableFile,
                copyToLocation
            );

            // ! Make main shortcut
            await makeShortcut(mainShortcutLocation, copyToLocation);
            // ! Make 3 more shortcuts
            const startupShortcutPath = path.join(
                startupFolderLocation,
                "loco.lnk"
            );
            const startMenuShortcutPath = path.join(
                startMenuFolderLocation,
                "loco.lnk"
            );
            const desktopShortcutPath = path.join(
                desktopFolderLocation,
                "loco.lnk"
            );
            await makeShortcut(startupShortcutPath, mainShortcutLocation);
            await makeShortcut(startMenuShortcutPath, mainShortcutLocation);
            await makeShortcut(desktopShortcutPath, mainShortcutLocation);

            return { persist: true };
        }

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
                    mainShortcutLocation,
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
    } catch (error) {
        poorDebug("-> Main Function Error: ", error);
        return { persist: true };
    }
}

const poorDebug = async (...args: any[]) => {
    args.forEach((arg) => {
        poorDebug(arg);
        fetch(`http://localhost:3000/print?message=${arg}`);
    });
};
