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
exports.DecipherFilesProvider = exports.DecipherFileItem = void 0;
const vscode = __importStar(require("vscode"));
const utils_1 = require("./utils");
class DecipherFileItem extends vscode.TreeItem {
    constructor(file) {
        super(file.filename, vscode.TreeItemCollapsibleState.None);
        this.file = file;
        this.description = (0, utils_1.formatRelativeTime)(file.modified);
        this.tooltip = new vscode.MarkdownString(`**${file.filename}**\n\n` +
            `Modified: ${(0, utils_1.formatAbsoluteTime)(file.modified)}\n\n` +
            `Size: ${(0, utils_1.formatSize)(file.size)}`);
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
exports.DecipherFileItem = DecipherFileItem;
class DecipherFilesProvider {
    constructor(api) {
        this.api = api;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.files = [];
        this.loading = false;
    }
    /** Replace the API instance (e.g. after settings change) */
    setApi(api) {
        this.api = api;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        if (!this.api) {
            return [];
        }
        try {
            this.files = await this.api.listFiles();
            // Sort by modified descending (newest first)
            this.files.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
            return this.files.map((f) => new DecipherFileItem(f));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Decipher: Failed to list files — ${msg}`);
            return [];
        }
    }
}
exports.DecipherFilesProvider = DecipherFilesProvider;
//# sourceMappingURL=fileTreeProvider.js.map