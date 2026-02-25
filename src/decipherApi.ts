import * as https from "https";
import * as http from "http";

export interface DecipherFile {
    filename: string;
    modified: string; // ISO-8601
    size: number;
}

export class DecipherApi {
    private serverUrl: string;
    private apiKey: string;
    private surveyPath: string;

    constructor(serverUrl: string, apiKey: string, surveyPath: string) {
        // Strip trailing slash
        this.serverUrl = serverUrl.replace(/\/$/, "");
        this.apiKey = apiKey;
        this.surveyPath = surveyPath;
    }

    private get baseApiUrl(): string {
        return `${this.serverUrl}/api/v1`;
    }

    private get surveyFilesUrl(): string {
        return `${this.baseApiUrl}/surveys/${this.surveyPath}/files`;
    }

    /** Make an HTTPS GET request and return body as string */
    private request(
        url: string,
        method: string,
        headers: Record<string, string>,
        body?: Buffer
    ): Promise<{ statusCode: number; body: Buffer }> {
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const options: https.RequestOptions = {
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
            const req = (protocol as typeof https).request(options, (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk: Buffer) => chunks.push(chunk));
                res.on("end", () =>
                    resolve({
                        statusCode: res.statusCode ?? 0,
                        body: Buffer.concat(chunks),
                    })
                );
            });

            req.on("error", reject);
            if (body) {
                req.write(body);
            }
            req.end();
        });
    }

    /** List all files in the survey */
    async listFiles(): Promise<DecipherFile[]> {
        const url = this.surveyFilesUrl;
        const result = await this.request(url, "GET", {
            Accept: "application/json",
        });

        if (result.statusCode !== 200) {
            throw new Error(
                `Failed to list files: HTTP ${result.statusCode}\n${result.body.toString()}`
            );
        }

        return JSON.parse(result.body.toString()) as DecipherFile[];
    }

    /** Download a file's raw contents */
    async downloadFile(filename: string): Promise<Buffer> {
        const url = `${this.surveyFilesUrl}/${encodeFilePath(filename)}`;
        const result = await this.request(url, "GET", {});

        if (result.statusCode !== 200) {
            throw new Error(
                `Failed to download "${filename}": HTTP ${result.statusCode}`
            );
        }

        return result.body;
    }

    /** Upload a file using multipart/form-data */
    async uploadFile(filename: string, contents: Buffer): Promise<void> {
        const url = `${this.surveyFilesUrl}/${encodeFilePath(filename)}`;

        // Build multipart body manually (no external deps)
        const boundary = "----DecipherBoundary" + Date.now().toString(16);
        const lines: Buffer[] = [];

        lines.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="contents"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
            )
        );
        lines.push(contents);
        lines.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const body = Buffer.concat(lines);

        const result = await this.request(url, "PUT", {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(body.length),
        }, body);

        if (result.statusCode !== 200 && result.statusCode !== 201) {
            throw new Error(
                `Failed to upload "${filename}": HTTP ${result.statusCode}\n${result.body.toString()}`
            );
        }
    }
}

/** URL-encode a file path but keep forward slashes intact */
function encodeFilePath(filePath: string): string {
    return filePath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}
