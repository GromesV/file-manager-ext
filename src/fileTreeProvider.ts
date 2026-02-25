import * as vscode from "vscode";
import { DecipherApi, DecipherFile } from "./decipherApi";
import { formatRelativeTime, formatAbsoluteTime, formatSize } from "./utils";

export class DecipherFileItem extends vscode.TreeItem {
    constructor(public readonly file: DecipherFile) {
        super(file.filename, vscode.TreeItemCollapsibleState.None);

        this.description = formatRelativeTime(file.modified);
        this.tooltip = new vscode.MarkdownString(
            `**${file.filename}**\n\n` +
            `Modified: ${formatAbsoluteTime(file.modified)}\n\n` +
            `Size: ${formatSize(file.size)}`
        );
        this.iconPath = new vscode.ThemeIcon("file");
        this.contextValue = "decipherFile";

        // Clicking the item triggers download
        this.command = {
            command: "decipherSync.downloadFile",
            title: "Download",
            arguments: [this],
        };
    }
}

export class DecipherFilesProvider
    implements vscode.TreeDataProvider<DecipherFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<
        DecipherFileItem | undefined | null | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private files: DecipherFile[] = [];
    private loading = false;
    private error: string | undefined;

    constructor(private api: DecipherApi | undefined) { }

    /** Replace the API instance (e.g. after settings change) */
    setApi(api: DecipherApi | undefined): void {
        this.api = api;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DecipherFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<DecipherFileItem[]> {
        if (!this.api) {
            return [];
        }

        try {
            this.files = await this.api.listFiles();
            // Sort by modified descending (newest first)
            this.files.sort(
                (a, b) =>
                    new Date(b.modified).getTime() - new Date(a.modified).getTime()
            );
            return this.files.map((f) => new DecipherFileItem(f));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Decipher: Failed to list files — ${msg}`);
            return [];
        }
    }
}
