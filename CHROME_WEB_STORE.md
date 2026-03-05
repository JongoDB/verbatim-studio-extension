# Chrome Web Store Submission Guide — Verbatim Studio Extension v1.0.0

## Assets You Need to Create

### Screenshots (REQUIRED — 1 to 5)
- **Dimensions:** 1280x800 px (or 640x400 px)
- **Format:** PNG or JPEG
- **Suggested screenshots:**
  1. Popup home screen showing all feature cards (Record, Capture, Upload, Search, Chat, Jobs)
  2. Side panel chat with Max — showing a conversation with context chips
  3. Search results with keyword highlighting
  4. Screen capture / recording in progress
  5. Jobs view showing active/completed jobs

### Small Promotional Tile (REQUIRED)
- **Dimensions:** 440x280 px
- **Format:** PNG or JPEG
- **Tips:** Use the Verbatim brand colors, avoid text, fill the entire region

### Marquee Promotional Tile (OPTIONAL — needed for featured placement)
- **Dimensions:** 1400x560 px

### Store Icon
- **Dimensions:** 128x128 px PNG
- **Already have:** `icons/icon-128.png` — use this

---

## Store Listing Fields

### Description (draft)

```
Verbatim Studio brings your local Verbatim Studio desktop app into your browser.

Record audio directly from any tab with automatic transcription. Capture screen regions and upload them for OCR processing. Upload documents, images, and files for text extraction and indexing. Search across all your recordings, documents, notes, and conversations with highlighted keyword matches. Chat with Max, your AI assistant, with full context from the current page, selected text, or attached documents.

Key Features:
- Audio recording with automatic transcription
- Screen capture with region selection
- File upload with OCR and text extraction
- Full-text search across all content with deep linking
- AI chat with page context, text selection, and document attachment
- Background job tracking with cancel support
- Save and load chat conversations

Requires Verbatim Studio desktop app running locally. All data stays on your machine — no external servers are contacted.
```

### Category
**Productivity > Tools** or **Productivity > Workflow & Planning**

### Language
English

---

## Privacy Tab Fields

### Single Purpose Description
```
Provides a browser interface for the locally-running Verbatim Studio desktop application, enabling audio recording, screen capture, file upload, search, and AI chat — all processed on the user's own machine.
```

### Permission Justifications

| Permission | Justification |
|------------|--------------|
| **activeTab** | Required to access the current tab when the user clicks the extension icon or uses the Globe button to capture page context for AI chat. Only activates on explicit user gesture. |
| **tabs** | Used to read the active tab's URL and title when the user clicks the Globe button in the side panel to attach page context to their AI chat. The side panel requires this permission because activeTab grants alone don't extend to the side panel context. |
| **sidePanel** | The side panel is the primary interface for the AI chat feature (Chat with Max). Users open it to have conversations with the AI assistant with attached context from pages, documents, and recordings. |
| **contextMenus** | Adds right-click menu options allowing users to quickly send selected text or page content to the Verbatim Studio chat assistant. |
| **notifications** | Displays system notifications to alert users when background jobs complete (transcription finished, upload processed, etc.) or encounter errors. |
| **storage** | Persists user preferences (theme, port configuration, notification settings) and UI state (dismissed job IDs, canceling job IDs) across popup/side panel sessions using chrome.storage.local and chrome.storage.session. |
| **offscreen** | Creates an offscreen document required for audio recording via the MediaRecorder API, which cannot run in the service worker context. The offscreen document captures microphone audio and sends recorded data back to the extension. |
| **scripting** | Used to programmatically inject a content script on the active tab when the user clicks the Globe button (to capture page text and selection) or uses screen capture (to display the region selection overlay). Only injected on demand via user action — no static content scripts run on all pages. |

### Host Permissions Justification
```
http://127.0.0.1:52780/* — The extension communicates exclusively with the Verbatim Studio desktop application running on the user's local machine at this localhost port. All API calls (recordings, documents, search, AI chat, jobs) go to this local server. No data is sent to any external server.
```

### Remote Code Declaration
**No** — The extension does not execute any remotely hosted code. All logic is bundled in the extension package.

### Data Usage Disclosures
- **Personally identifiable information:** Not collected
- **Health information:** Not collected
- **Financial information:** Not collected
- **Authentication information:** Not collected
- **Personal communications:** Not collected
- **Location:** Not collected
- **Web history:** Not collected (tab URL is read transiently on user gesture only, never stored or transmitted externally)
- **User activity:** Not collected
- **Website content:** Read transiently on user gesture (Globe button) to provide context to the local AI assistant. Never transmitted to external servers.

### Data Usage Certifications
- All data handling complies with the Chrome Web Store User Data Policy
- No data is sold to third parties
- No data is used for purposes unrelated to the extension's core functionality
- No data is used for creditworthiness or lending purposes

---

## Privacy Policy (draft — host at a public URL)

```
Privacy Policy for Verbatim Studio Browser Extension

Last updated: March 2026

Verbatim Studio ("the Extension") is a browser extension that provides an
interface to the Verbatim Studio desktop application running on your local
machine.

Data Collection and Use

The Extension does NOT collect, store, or transmit any personal data to
external servers. All communication occurs exclusively between your browser
and the Verbatim Studio desktop application running on your local machine
(127.0.0.1).

When you use the Globe button, the Extension may read the current page's URL,
selected text, and page content. This data is sent only to your local
Verbatim Studio instance to provide context for the AI chat feature. It is
never transmitted to any external server.

When you record audio, the recording is sent directly to your local Verbatim
Studio instance for transcription and storage. No audio data leaves your
machine.

Permissions

The Extension requests browser permissions solely to enable its core
features (audio recording, screen capture, page context capture, local API
communication). A full list of permissions and their purposes is available
on the Chrome Web Store listing.

Third Parties

The Extension does not share any data with third parties. The Extension does
not contain any analytics, tracking, or advertising code.

Data Storage

User preferences (theme, port settings) are stored locally in the browser
using chrome.storage. No data is stored on external servers.

Contact

For questions about this privacy policy, please contact [YOUR EMAIL]
or visit [YOUR WEBSITE].

The use of information received from Google APIs will adhere to the Chrome
Web Store User Data Policy, including the Limited Use requirements.
```

---

## Build & Package Checklist

- [x] Manifest V3
- [x] manifest.json `name` under 75 characters ("Verbatim Studio" = 15 chars)
- [x] manifest.json `description` under 132 characters
- [x] manifest.json `version` set to "1.0.0"
- [x] Icons: 16, 32, 48, 128px PNGs included
- [x] No static content_scripts (switched to on-demand injection)
- [x] No remotely hosted code
- [x] Service worker for background
- [x] .zip package built from dist/ with manifest.json at root
- [ ] Screenshots: 1-5 at 1280x800px (YOU CREATE)
- [ ] Small promotional tile: 440x280px (YOU CREATE)
- [ ] Privacy policy hosted at public URL (YOU HOST)
- [ ] Store description entered in dashboard (DRAFT ABOVE)
- [ ] Permission justifications entered in dashboard (DRAFTS ABOVE)
- [ ] Single purpose statement entered in dashboard (DRAFT ABOVE)
- [ ] Data usage disclosures checked in dashboard
- [ ] Category selected (Productivity > Tools)

## Packaging Command

From the project root after `npm run build`:

```bash
cd dist && zip -r ../verbatim-studio-extension-1.0.0.zip . -x "*.DS_Store" && cd ..
```

This creates a .zip with manifest.json at the root, ready for upload to the Chrome Developer Dashboard.
