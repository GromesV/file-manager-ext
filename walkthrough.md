# Decipher File Manager — Walkthrough

## What Was Built

A VS Code extension (`decipher-file-manager`) that integrates with the FocusVision Decipher API to manage survey files directly from VS Code.

## File Structure

```
d:\webdev\file-manager\
├── .vscode/
│   ├── launch.json          ← F5 debug config
│   └── tasks.json           ← tsc-watch build task
├── media/
│   └── decipher.svg         ← Activity Bar icon
├── src/
│   ├── extension.ts         ← Entry point, command registration
│   ├── decipherApi.ts       ← HTTP client (list/download/upload)
│   ├── fileTreeProvider.ts  ← Sidebar TreeDataProvider
│   └── utils.ts             ← Relative time, size formatting
├── out/                     ← Compiled JS (generated)
├── package.json
└── tsconfig.json
```

## Features Implemented

| Feature | How it works |
|---------|-------------|
| **Sidebar panel** | Activity Bar icon → "Decipher" panel listing all server files |
| **Relative timestamps** | "3 min ago", "yesterday", "2 weeks ago" etc. |
| **Tooltip** | Full date + file size on hover |
| **Sort** | Newest files shown first |
| **Click to download** | Saves to workspace root, preserving subfolder path |
| **Right-click → Upload** | Explorer context menu on any file |
| **Auto-refresh** | Panel refreshes every 60s when visible |
| **API Key** | Stored securely in VS Code SecretStorage |
| **Missing config prompt** | Guides user to settings on first launch |

## How to Use

### 1. Open the extension folder
Open `d:\webdev\file-manager` in VS Code.

### 2. Press F5
A new **Extension Development Host** window opens with the extension active.

### 3. Configure settings
In the Extension Development Host window, open Settings (`Ctrl+,`) and search **decipher**:

| Setting | Example Value |
|---------|--------------|
| `decipherSync.serverUrl` | `https://surveys.focusvision.com` |
| `decipherSync.surveyPath` | `selfserve/1a/123456` |

Then run the command palette command **"Decipher: Set API Key"** to securely store your API key.

### 4. Use the panel
- Click the **document icon** in the Activity Bar to open the Decipher panel
- Click **Refresh** (↺) to reload the file list
- **Click any file** to download it into your workspace
- **Right-click any file** in the Explorer tree → **Upload to Decipher**

## API Details

- **List files:** `GET /api/v1/surveys/{survey}/files`
- **Download:** `GET /api/v1/surveys/{survey}/files/{filename}`
- **Upload:** `PUT /api/v1/surveys/{survey}/files/{filename}` (multipart/form-data)
- **Auth header:** `x-apikey: <your-key>`

## Compilation

TypeScript compiled cleanly with **0 errors**:
```
> tsc -p ./
(no output = success)
```
