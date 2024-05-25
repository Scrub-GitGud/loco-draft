import fs from "fs";
import path from "path";
import os from "os";

const desktopFolderPath = path.join(os.homedir());
const files = fs.readdirSync(desktopFolderPath);
console.log(desktopFolderPath);
console.log(files);
