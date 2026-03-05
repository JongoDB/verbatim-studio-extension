export const metadata = {
  title: "Privacy Policy — Verbatim Studio Browser Extension",
  description:
    "Privacy policy for the Verbatim Studio browser extension. All data stays on your machine.",
};

export default function ExtensionPrivacyPage() {
  return (
    <main className="px-6 py-28 md:py-36 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
        Privacy Policy
      </h1>
      <p className="text-white/40 text-sm mb-12">
        Verbatim Studio Browser Extension &middot; Last updated: March 2026
      </p>

      <div className="space-y-10 text-white/70 leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Overview
          </h2>
          <p>
            The Verbatim Studio Browser Extension (&ldquo;the Extension&rdquo;)
            provides an interface to the Verbatim Studio desktop application
            running on your local machine. This policy explains how the
            Extension handles your data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Data Collection and Use
          </h2>
          <p>
            The Extension does <strong className="text-white">not</strong>{" "}
            collect, store, or transmit any personal data to external servers.
            All communication occurs exclusively between your browser and the
            Verbatim Studio desktop application running on your local machine
            (127.0.0.1).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Page Context
          </h2>
          <p>
            When you use the Globe button, the Extension may read the current
            page&rsquo;s URL, selected text, and page content. This data is sent
            only to your local Verbatim Studio instance to provide context for
            the AI chat feature. It is never transmitted to any external server.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Audio Recording
          </h2>
          <p>
            When you record audio, the recording is sent directly to your local
            Verbatim Studio instance for transcription and storage. No audio
            data leaves your machine.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Permissions
          </h2>
          <p>
            The Extension requests browser permissions solely to enable its core
            features: audio recording, screen capture, page context capture, and
            local API communication. A full list of permissions and their
            purposes is available on the{" "}
            <a
              href="https://chromewebstore.google.com"
              className="text-brand-blue-bright hover:underline"
            >
              Chrome Web Store listing
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Third Parties
          </h2>
          <p>
            The Extension does not share any data with third parties. It does
            not contain any analytics, tracking, or advertising code.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Data Storage
          </h2>
          <p>
            User preferences (theme, port settings) are stored locally in the
            browser using <code className="text-white/90">chrome.storage</code>.
            No data is stored on external servers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Google API Compliance
          </h2>
          <p>
            The use of information received from Google APIs adheres to the{" "}
            <a
              href="https://developer.chrome.com/docs/webstore/program-policies/user-data/"
              className="text-brand-blue-bright hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chrome Web Store User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-white mb-3">
            Contact
          </h2>
          <p>
            For questions about this privacy policy, please{" "}
            <a
              href="https://github.com/JongoDB/verbatim-studio/issues"
              className="text-brand-blue-bright hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              open an issue on GitHub
            </a>{" "}
            or email{" "}
            <a
              href="mailto:support@verbatimstudio.app"
              className="text-brand-blue-bright hover:underline"
            >
              support@verbatimstudio.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
