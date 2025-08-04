// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let pythonProcess = null;
let currentProcessedFiles = null;

// --- Auto-updater setup ---
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version ${info.version} is available. Do you want to download it now?`,
        buttons: ['Yes', 'No']
    }).then(result => {
        if (result.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'The update is ready to be installed. The application will restart to install it.',
        buttons: ['OK']
    }).then(() => {
        autoUpdater.quitAndInstall();
    });
});

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 383,
        frame: false,
        resizable: false,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers for Window Controls ---
ipcMain.on('minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('close', () => {
    if (mainWindow) mainWindow.close();
});

// --- IPC Handler for Manual Update Check ---
ipcMain.handle('check-for-updates', async () => {
    autoUpdater.checkForUpdatesAndNotify();
    return { status: "checking" };
});

// --- IPC Handlers for File Dialogs and Python Interaction ---
ipcMain.handle('open-directory-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return (!canceled && filePaths.length > 0) ? filePaths[0] : null;
});

ipcMain.handle('organize-files', (event, sourceDir, destinationDir) => {
    return new Promise((resolve, reject) => {
        if (pythonProcess) {
            return reject({ status: "error", message: "Another Python process is already running." });
        }

        const pythonExecutable = process.env.PYTHON_PATH || 'python3';
        const pythonScriptPath = path.join(__dirname, 'backend', 'file_organizer_backend.py');

        pythonProcess = spawn(pythonExecutable, ['-u', pythonScriptPath, 'organize', sourceDir, destinationDir]);

        let stdoutBuffer = "";
        let errorOutput = "";

        pythonProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            let lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop();

            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line.trim());
                        if (message.type === "status" || message.type === "progress" || message.type === "complete") {
                            mainWindow.webContents.send(`organize-${message.type}`, message);
                        }
                    } catch (e) {
                        console.error('Failed to parse JSON from Python stdout:', line, e);
                    }
                }
            });
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`Python stderr: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            pythonProcess = null;
            if (code !== 0) {
                mainWindow.webContents.send('organize-error', { message: errorOutput || `Python process exited with code ${code}.` });
                reject({ status: "error", message: errorOutput || `Python process exited with code ${code}.`, code: code });
            } else {
                resolve({ status: "success", message: "Python process finished." });
            }
        });

        pythonProcess.on('error', (err) => {
            pythonProcess = null;
            reject({ status: "error", message: `Failed to start Python process: ${err.message}` });
        });
    });
});

ipcMain.handle('delete-source-files', async (event, processedFilesInfo) => {
    return new Promise((resolve, reject) => {
        if (pythonProcess) {
            return reject({ status: "error", message: "Another Python process is already running." });
        }
        if (!processedFilesInfo) {
            return reject({ status: "error", message: "No files were organized or processed file info is missing." });
        }

        const pythonExecutable = process.env.PYTHON_PATH || 'python3';
        const pythonScriptPath = path.join(__dirname, 'backend', 'file_organizer_backend.py');
        const processedFilesJson = JSON.stringify(processedFilesInfo);

        pythonProcess = spawn(pythonExecutable, ['-u', pythonScriptPath, 'delete', processedFilesJson]);

        let stdoutBuffer = "";
        let errorOutput = "";

        pythonProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            let lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop();

            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line.trim());
                        if (message.type === "delete_status" || message.type === "delete_progress" || message.type === "delete_complete") {
                            mainWindow.webContents.send(message.type, message);
                        }
                    } catch (e) {
                        console.error('Failed to parse JSON from Python delete stdout:', line, e);
                    }
                }
            });
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`Python delete stderr: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            pythonProcess = null;
            if (code !== 0) {
                mainWindow.webContents.send('delete-error', { message: errorOutput || `Python deletion process exited with code ${code}.` });
                reject({ status: "error", message: errorOutput || `Python deletion process exited with code ${code}.`, code: code });
            } else {
                resolve({ status: "success", message: "Python delete process finished." });
            }
        });

        pythonProcess.on('error', (err) => {
            pythonProcess = null;
            reject({ status: "error", message: `Failed to start Python process for deletion: ${err.message}` });
        });
    });
});