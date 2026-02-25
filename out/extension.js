"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const decipherApi_1 = require("./decipherApi");
const fileTreeProvider_1 = require("./fileTreeProvider");
const SECRET_KEY = "decipherSync.apiKey";
/** Build a DecipherApi from current VS Code settings + stored secret */
async function buildApi(context) {
    const config = vscode.workspace.getConfiguration("decipherSync");
    const serverUrl = config.get("serverUrl", "").trim();
    const surveyPath = config.get("surveyPath", "").trim();
    const apiKey = (await context.secrets.get(SECRET_KEY)) ?? "";
    if (!serverUrl || !surveyPath || !apiKey) {
        return undefined;
    }
    return new decipherApi_1.DecipherApi(serverUrl, apiKey, surveyPath);
}
async function activate(context) {
    // --- API client & tree provider ---
    let api = await buildApi(context);
    const provider = new fileTreeProvider_1.DecipherFilesProvider(api);
    const treeView = vscode.window.createTreeView("decipherFilesView", {
        treeDataProvider: provider,
        showCollapseAll: false,
    });
    context.subscriptions.push(treeView);
    // Re-build API when settings change
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("decipherSync")) {
            api = await buildApi(context);
            provider.setApi(api);
            provider.refresh();
        }
    }));
    // --- Command: Set API Key ---
    context.subscriptions.push(vscode.commands.registerCommand("decipherSync.setApiKey", async () => {
        const key = await vscode.window.showInputBox({
            title: "Decipher API Key",
            prompt: "Enter your Decipher x-apikey value",
            password: true,
            ignoreFocusOut: true,
        });
        if (key === undefined) {
            return; // cancelled
        }
        await context.secrets.store(SECRET_KEY, key);
        api = await buildApi(context);
        provider.setApi(api);
        provider.refresh();
        vscode.window.showInformationMessage("Decipher: API key saved.");
    }));
    // --- Command: Refresh ---
    context.subscriptions.push(vscode.commands.registerCommand("decipherSync.refresh", () => {
        provider.refresh();
    }));
    // --- Command: Download file (invoked when user clicks an item) ---
    context.subscriptions.push(vscode.commands.registerCommand("decipherSync.downloadFile", async (item) => {
        if (!api) {
            await promptMissingConfig();
            return;
        }
        const filename = item.file.filename;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Decipher: Downloading ${filename}…`,
            cancellable: false,
        }, async () => {
            try {
                const contents = await api.downloadFile(filename);
                // Determine save path — preserve sub-path within workspace root
                const workspaceRoot = getWorkspaceRoot();
                const targetPath = workspaceRoot
                    ? path.join(workspaceRoot, filename)
                    : undefined;
                if (!targetPath) {
                    // No workspace open — ask user where to save
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(filename),
                    });
                    if (!uri) {
                        return;
                    }
                    fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
                    fs.writeFileSync(uri.fsPath, contents);
                    await vscode.window.showTextDocument(uri);
                }
                else {
                    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                    fs.writeFileSync(targetPath, contents);
                    const uri = vscode.Uri.file(targetPath);
                    await vscode.window.showTextDocument(uri);
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Decipher: Download failed — ${msg}`);
            }
        });
    }));
    // --- Command: Upload file (Explorer right-click context menu) ---
    context.subscriptions.push(vscode.commands.registerCommand("decipherSync.uploadFile", async (uri) => {
        if (!api) {
            await promptMissingConfig();
            return;
        }
        if (!uri) {
            vscode.window.showErrorMessage("Decipher: No file selected for upload.");
            return;
        }
        // Compute relative path from workspace root to use as the server filename
        const workspaceRoot = getWorkspaceRoot();
        let serverFilename;
        if (workspaceRoot) {
            serverFilename = path
                .relative(workspaceRoot, uri.fsPath)
                .replace(/\\/g, "/");
        }
        else {
            serverFilename = path.basename(uri.fsPath);
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Decipher: Uploading ${serverFilename}…`,
            cancellable: false,
        }, async () => {
            try {
                const contents = fs.readFileSync(uri.fsPath);
                await api.uploadFile(serverFilename, contents);
                vscode.window.showInformationMessage(`Decipher: "${serverFilename}" uploaded successfully.`);
                provider.refresh();
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Decipher: Upload failed — ${msg}`);
            }
        });
    }));
    // Auto-refresh every 60 seconds while the panel is visible
    const refreshTimer = setInterval(() => {
        if (treeView.visible) {
            provider.refresh();
        }
    }, 60000);
    context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
    // Prompt to set API key if not yet configured on first activation
    const existingKey = await context.secrets.get(SECRET_KEY);
    if (!existingKey) {
        const action = await vscode.window.showInformationMessage("Decipher File Manager: No API key found. Set one to get started.", "Set API Key");
        if (action === "Set API Key") {
            await vscode.commands.executeCommand("decipherSync.setApiKey");
        }
    }
}
function deactivate() {
    // Nothing to clean up — subscriptions handle disposal
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getWorkspaceRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
async function promptMissingConfig() {
    const parts = [];
    const config = vscode.workspace.getConfiguration("decipherSync");
    if (!config.get("serverUrl", "").trim()) {
        parts.push("Server URL");
    }
    if (!config.get("surveyPath", "").trim()) {
        parts.push("Survey Path");
    }
    parts.push("API Key"); // always mention it if we reached here without one
    const action = await vscode.window.showWarningMessage(`Decipher: Please configure ${parts.join(", ")} before using this extension.`, "Open Settings", "Set API Key");
    if (action === "Open Settings") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "decipherSync");
    }
    else if (action === "Set API Key") {
        await vscode.commands.executeCommand("decipherSync.setApiKey");
    }
}
//# sourceMappingURL=extension.js.map