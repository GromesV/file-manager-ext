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
exports.DecipherApi = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
class DecipherApi {
    constructor(serverUrl, apiKey, surveyPath) {
        // Strip trailing slash
        this.serverUrl = serverUrl.replace(/\/$/, "");
        this.apiKey = apiKey;
        this.surveyPath = surveyPath;
    }
    get baseApiUrl() {
        return `${this.serverUrl}/api/v1`;
    }
    get surveyFilesUrl() {
        return `${this.baseApiUrl}/surveys/${this.surveyPath}/files`;
    }
    /** Make an HTTPS GET request and return body as string */
    request(url, method, headers, body) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method,
                headers: {
                    "x-apikey": this.apiKey,
                    ...headers,
                },
            };
            const protocol = parsed.protocol === "https:" ? https : http;
            const req = protocol.request(options, (res) => {
                const chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => resolve({
                    statusCode: res.statusCode ?? 0,
                    body: Buffer.concat(chunks),
                }));
            });
            req.on("error", reject);
            if (body) {
                req.write(body);
            }
            req.end();
        });
    }
    /** List all files in the survey */
    async listFiles() {
        const url = this.surveyFilesUrl;
        const result = await this.request(url, "GET", {
            Accept: "application/json",
        });
        if (result.statusCode !== 200) {
            throw new Error(`Failed to list files: HTTP ${result.statusCode}\n${result.body.toString()}`);
        }
        return JSON.parse(result.body.toString());
    }
    /** Download a file's raw contents */
    async downloadFile(filename) {
        const url = `${this.surveyFilesUrl}/${encodeFilePath(filename)}`;
        const result = await this.request(url, "GET", {});
        if (result.statusCode !== 200) {
            throw new Error(`Failed to download "${filename}": HTTP ${result.statusCode}`);
        }
        return result.body;
    }
    /** Upload a file using multipart/form-data */
    async uploadFile(filename, contents) {
        const url = `${this.surveyFilesUrl}/${encodeFilePath(filename)}`;
        // Build multipart body manually (no external deps)
        const boundary = "----DecipherBoundary" + Date.now().toString(16);
        const lines = [];
        lines.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="contents"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
        lines.push(contents);
        lines.push(Buffer.from(`\r\n--${boundary}--\r\n`));
        const body = Buffer.concat(lines);
        const result = await this.request(url, "PUT", {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(body.length),
        }, body);
        if (result.statusCode !== 200 && result.statusCode !== 201) {
            throw new Error(`Failed to upload "${filename}": HTTP ${result.statusCode}\n${result.body.toString()}`);
        }
    }
}
exports.DecipherApi = DecipherApi;
/** URL-encode a file path but keep forward slashes intact */
function encodeFilePath(filePath) {
    return filePath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}
//# sourceMappingURL=decipherApi.js.map