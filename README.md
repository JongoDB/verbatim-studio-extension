# Verbatim Studio Chrome Extension

A Chrome extension companion for Verbatim Studio — interact with your local desktop app directly from your browser.

## Features

- **Connection Status** — Real-time indicator showing if Verbatim Studio is running
- **Audio Recording** — Record audio with level metering, pause/resume, and auto-upload for transcription
- **Screen Capture** — Full-page or region-select screenshots uploaded as documents
- **Chat with Max** — AI chat in a persistent side panel with streaming responses and context attachment
- **File Upload** — Drag-and-drop upload of documents, audio, and video files
- **Search** — Keyword and semantic search across all your content
- **Job Tracking** — Live progress on transcription and processing jobs via WebSocket
- **Context Menu** — Right-click to upload images or send selected text to chat

## Prerequisites

- [Verbatim Studio](https://verbatimstudio.com) desktop app running locally (default port: 52780)
- Node.js 18+
- Chrome browser

## Build

```bash
npm install
npm run build
```

The built extension will be in the `dist/` directory.

## Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project
5. The Verbatim Studio extension icon should appear in your toolbar

## Development

```bash
npm run dev
```

This runs Vite in watch mode, rebuilding on file changes. After each rebuild, go to `chrome://extensions` and click the refresh button on the extension card.

## Configuration

Click the gear icon in the popup or go to the extension's Options page to configure:

- **Backend Port** — Change if Verbatim Studio runs on a non-default port
- **Theme** — Light, dark, or system-matched
- **Notifications** — Toggle job completion notifications
- **Auto-reconnect** — Automatically reconnect when the connection drops

## Architecture

- **Manifest V3** with service worker for background processing
- **React 18** + **TypeScript** for popup and side panel UIs
- **Tailwind CSS** matching Verbatim Studio's design system
- **Zustand** for client state, **React Query** for server state
- WebSocket connection for real-time job progress and notifications

## Tech Stack

| Component | Technology |
|-----------|-----------|
| UI Framework | React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| Build | Vite |
| State | Zustand + React Query |
| Icons | Lucide React |
