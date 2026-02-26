import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { DecipherApi } from "./decipherApi";
import { DecipherFileItem, DecipherFilesProvider } from "./fileTreeProvider";

const SECRET_KEY = "decipherSync.apiKey";

/** Build a DecipherApi from current VS Code settings + stored secret */
async function buildApi(
    context: vscode.ExtensionContext
): Promise<DecipherApi | undefined> {
    const config = vscode.workspace.getConfiguration("decipherSync");
    const serverUrl = config.get<string>("serverUrl", "").trim();
    const surveyPath = config.get<string>("surveyPath", "").trim();
    const apiKey = (await context.secrets.get(SECRET_KEY)) ?? "";

    if (!serverUrl || !surveyPath || !apiKey) {
        return undefined;
    }
    return new DecipherApi(serverUrl, apiKey, surveyPath);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // --- API client & tree provider ---
    let api = await buildApi(context);
    const provider = new DecipherFilesProvider(api);

    const treeView = vscode.window.createTreeView("decipherFilesView", {
        treeDataProvider: provider,
        showCollapseAll: false,
    });
    context.subscriptions.push(treeView);

    // Re-build API when settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("decipherSync")) {
                api = await buildApi(context);
                provider.setApi(api);
                provider.refresh();
            }
        })
    );

    // --- Command: Set API Key ---
    context.subscriptions.push(
        vscode.commands.registerCommand("decipherSync.setApiKey", async () => {
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
        })
    );

    // --- Command: Refresh ---
    context.subscriptions.push(
        vscode.commands.registerCommand("decipherSync.refresh", () => {
            provider.refresh();
        })
    );

    // --- Command: Download file (invoked when user clicks an item) ---
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "decipherSync.downloadFile",
            async (item: DecipherFileItem) => {
                if (!api) {
                    await promptMissingConfig();
                    return;
                }

                const filename = item.file.filename;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Decipher: Downloading ${filename}…`,
                        cancellable: false,
                    },
                    async () => {
                        try {
                            const contents = await api!.downloadFile(filename);

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
                                await vscode.workspace.fs.createDirectory(
                                    vscode.Uri.file(path.dirname(uri.fsPath))
                                );
                                await vscode.workspace.fs.writeFile(uri, contents);
                                await vscode.window.showTextDocument(uri);
                            } else {
                                const uri = vscode.Uri.file(targetPath);
                                await vscode.workspace.fs.createDirectory(
                                    vscode.Uri.file(path.dirname(targetPath))
                                );
                                await vscode.workspace.fs.writeFile(uri, contents);
                                await vscode.window.showTextDocument(uri);
                            }
                        } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            vscode.window.showErrorMessage(
                                `Decipher: Download failed — ${msg}`
                            );
                        }
                    }
                );
            }
        )
    );

    // --- Command: Upload file (Explorer right-click context menu) ---
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "decipherSync.uploadFile",
            async (uri: vscode.Uri) => {
                if (!api) {
                    await promptMissingConfig();
                    return;
                }
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "Decipher: No file selected for upload."
                    );
                    return;
                }

                // Compute relative path from workspace root to use as the server filename
                const workspaceRoot = getWorkspaceRoot();
                let serverFilename: string;
                if (workspaceRoot) {
                    serverFilename = path
                        .relative(workspaceRoot, uri.fsPath)
                        .replace(/\\/g, "/");
                } else {
                    serverFilename = path.basename(uri.fsPath);
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Decipher: Uploading ${serverFilename}…`,
                        cancellable: false,
                    },
                    async () => {
                        try {
                            const contents = fs.readFileSync(uri.fsPath);
                            await api!.uploadFile(serverFilename, contents);
                            vscode.window.showInformationMessage(
                                `Decipher: "${serverFilename}" uploaded successfully.`
                            );
                            provider.refresh();
                        } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            vscode.window.showErrorMessage(
                                `Decipher: Upload failed — ${msg}`
                            );
                        }
                    }
                );
            }
        )
    );

    // Auto-refresh every 60 seconds while the panel is visible
    const refreshTimer = setInterval(() => {
        if (treeView.visible) {
            provider.refresh();
        }
    }, 60_000);
    context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });

    // Prompt to set API key if not yet configured on first activation
    const existingKey = await context.secrets.get(SECRET_KEY);
    if (!existingKey) {
        const action = await vscode.window.showInformationMessage(
            "Decipher File Manager: No API key found. Set one to get started.",
            "Set API Key"
        );
        if (action === "Set API Key") {
            await vscode.commands.executeCommand("decipherSync.setApiKey");
        }
    }
}

export function deactivate(): void {
    // Nothing to clean up — subscriptions handle disposal
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function promptMissingConfig(): Promise<void> {
    const parts: string[] = [];
    const config = vscode.workspace.getConfiguration("decipherSync");
    if (!config.get<string>("serverUrl", "").trim()) {
        parts.push("Server URL");
    }
    if (!config.get<string>("surveyPath", "").trim()) {
        parts.push("Survey Path");
    }
    parts.push("API Key"); // always mention it if we reached here without one

    const action = await vscode.window.showWarningMessage(
        `Decipher: Please configure ${parts.join(", ")} before using this extension.`,
        "Open Settings",
        "Set API Key"
    );
    if (action === "Open Settings") {
        await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "decipherSync"
        );
    } else if (action === "Set API Key") {
        await vscode.commands.executeCommand("decipherSync.setApiKey");
    }
}
