import Link from "next/link";

export const metadata = {
  title: "Browser Extension — Verbatim Studio",
  description:
    "Bring Verbatim Studio into your browser. Record, capture, search, and chat with AI — all from one extension.",
};

export default function ExtensionPage() {
  return (
    <main className="px-6 py-28 md:py-36">
      {/* Hero */}
      <div className="max-w-3xl mx-auto text-center mb-20">
        <p className="text-brand-blue-bright text-sm font-medium tracking-wide uppercase mb-4">
          Browser Extension
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6">
          Verbatim Studio,
          <br />
          right in your browser
        </h1>
        <p className="text-white/50 text-lg md:text-xl max-w-xl mx-auto mb-8">
          Record audio, capture screens, chat with your AI assistant, upload
          documents, and search — all without leaving your tab.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://chromewebstore.google.com"
            className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-white/90 transition-colors"
          >
            <ChromeIcon />
            Add to Chrome
          </a>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium px-6 py-3 rounded-lg border border-white/[0.06] hover:border-white/10 transition-colors"
          >
            Documentation
          </Link>
        </div>
      </div>

      {/* Features grid */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-blue-bright/10 flex items-center justify-center mb-4 text-brand-blue-bright">
              {f.icon}
            </div>
            <h3 className="font-display text-lg font-semibold text-white mb-2">
              {f.title}
            </h3>
            <p className="text-white/40 text-sm leading-relaxed">
              {f.description}
            </p>
          </div>
        ))}
      </div>

      {/* Requires desktop app note */}
      <div className="max-w-2xl mx-auto text-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
        <h3 className="font-display text-lg font-semibold text-white mb-2">
          Requires Verbatim Studio
        </h3>
        <p className="text-white/40 text-sm mb-4">
          The browser extension connects to the Verbatim Studio desktop app
          running on your machine. All data stays local — nothing is sent to
          external servers.
        </p>
        <Link
          href="/"
          className="text-brand-blue-bright text-sm hover:underline"
        >
          Download Verbatim Studio &rarr;
        </Link>
      </div>

      {/* Privacy link */}
      <div className="max-w-3xl mx-auto text-center mt-12">
        <Link
          href="/extension/privacy"
          className="text-white/30 text-sm hover:text-white/50 transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}

function ChromeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L9.5 12.8c.45 1.86 2.13 3.2 4.1 3.2.73 0 1.42-.19 2.02-.52L19.32 15c-1.35 2.96-4.35 5-7.82 5zm8-5.5l-3.81-6.6C14.72 7.35 13.41 7 12 7c-1.84 0-3.46.97-4.37 2.42L3.82 9.5C5.17 5.94 8.3 3.5 12 3.5c3.45 0 6.43 2.17 7.6 5.22L20 9.5v5z" />
    </svg>
  );
}

const features = [
  {
    title: "Record Audio",
    description:
      "Capture microphone audio from any tab with one click. Recordings are automatically sent for transcription.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      </svg>
    ),
  },
  {
    title: "Screen Capture",
    description:
      "Select a region of your screen to capture. Images are uploaded and processed with OCR automatically.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    title: "Chat with Max",
    description:
      "Ask your AI assistant questions with full context from the current page, selected text, or attached documents.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: "Upload Files",
    description:
      "Upload documents, images, and media files for text extraction, OCR processing, and indexing.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: "Full-Text Search",
    description:
      "Search across all your recordings, documents, notes, and conversations with highlighted keyword matches.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    title: "Background Jobs",
    description:
      "Track transcription, OCR, and indexing jobs in real time with progress bars and cancel support.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
];
