"use strict"

/*

This file is a part of ubports-installer

Author: Marius Gripsgard <mariogrip@ubports.com>

*/

const builder = require("electron-builder")
const cli = require("commander");
const utils = require("./src/utils");
const unzip = require("unzip");
const path = require("path");
const fs = require("fs-extra");
const events = require("events");
class event extends events {}
const Platform = builder.Platform
const platfromToolsPath = "./platform-tools"
const platformToolsUrls = {
    "linux": "https://dl.google.com/android/repository/platform-tools-latest-linux.zip",
    "mac": "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
    "win": "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
}


const setEvents = (downloadEvent) => {
    downloadEvent.on("download:error", (r) => {
        console.log("Download error " + r);
    });
    downloadEvent.on("error", (r) => {
        console.log("Error: " + r);
    });
    downloadEvent.on("download:start", (r) => {
        console.log("Starting download of " + r + " files");
    });
    downloadEvent.on("download:next", (i) => {
        console.log(`Downloading next file, ${i} left`);
    });
    downloadEvent.on("download:progress", (i) => {
        process.stdout.write(`Downloading file, ${Math.ceil(i.percent*100)}% left\r`);
    });
}

function build() {
    var linuxTargets = cli.appimageOnly ? "AppImage" : ["AppImage", "snap", "deb"];
    builder.build({
            targets: builder.createTargets(targets),
            config: {
                "appId": "com.ubports.installer",
                "linux": {
                    "target": linuxTargets
                },
                "mac": {
                    "target": "dmg"
                },
                "win": {
                    "target": ["portable"]
                },
                "files": [
                    "src/**/*",
                    "node_modules/**/*",
                    "platform-tools/${os}/**/*"
                ]
            }
        })
        .then(() => {
            console.log("Done")
        })
        .catch(console.log)
}

function getAndroidPlatfromTools() {
    var targets = [];
    var downloadArray = [];
    if (cli.linux) targets.push("linux");
    if (cli.windows) targets.push("win");
    if (cli.mac) targets.push("mac");
    if (targets.length === 0) targets = ["linux", "win", "mac"];

    targets.forEach((target) => {
        downloadArray.push({
            url: platformToolsUrls[target],
            path: platfromToolsPath,
            target: target
        })
    });
    return downloadArray;
};

function downloadPlatformTools() {
    const downloadEvent = new event();
    setEvents(downloadEvent);
    utils.downloadFiles(getAndroidPlatfromTools(), downloadEvent);
    downloadEvent.on("download:done", () => {
        extractPlatformTools(getAndroidPlatfromTools(), () => {
            if (!cli.downloadOnly) build();
        });
    });
};

function extractPlatformTools(platfromToolsArray, callback) {
    var i = platfromToolsArray[0];
    fs.createReadStream(path.join(i.path, path.basename(i.url))).pipe(unzip.Extract({
        path: path.join(i.path, i.target+"_tmp")
    })).on("close", () => {
        fs.move(path.join(i.path, i.target+"_tmp", "platform-tools"), path.join(i.path, i.target), { overwrite: true }, (e) => {
            fs.removeSync(path.join(i.path, i.target+"_tmp"))
            if(i.target !== "win") {
                fs.chmodSync(path.join(i.path, i.target, "fastboot"), 0o755);
                fs.chmodSync(path.join(i.path, i.target, "adb"), 0o755);
            }
            if (platfromToolsArray.length <= 1) {
                callback()
            } else {
                platfromToolsArray.shift();
                extractPlatformTools(platfromToolsArray, callback);
            }
        });
    });
}

cli
    .version(1)
    .option('-l, --linux', 'Build for Linux')
    .option('-a, --appimage-only', "Build only appimage")
    .option('-w, --windows', 'Build for Windows')
    .option('-m, --mac', 'Build for Mac')
    .option('-d, --download-only', 'Only download platformTools')
    .parse(process.argv);

var targets = [];

if (cli.linux) targets.push(Platform.LINUX);
if (cli.windows) targets.push(Platform.WINDOWS);
if (cli.mac) targets.push(Platform.MAC);

if (targets.length === 0) targets = [Platform.MAC, Platform.WINDOWS, Platform.LINUX];

downloadPlatformTools()