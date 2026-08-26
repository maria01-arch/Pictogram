export default function PrivacyPolicyView() {
  return (
    <div className="px-4 pb-16 pt-6">
      <h2 className="text-lg font-bold">Privacy Policy</h2>
      <p className="mt-1 text-xs text-ink-muted">Last updated: [DATE]</p>

      <div className="mt-3 rounded-xl2 bg-black/5 p-3 text-xs text-ink-muted dark:bg-white/10">
        This is a draft template, not legal advice. Fill in the [bracketed] placeholders
        and have it reviewed by a lawyer before you rely on it — requirements vary by
        where your users are located (e.g. GDPR in the EU/UK, CCPA in California).
      </div>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-muted">
        <section>
          <h3 className="text-sm font-semibold text-ink">Who we are</h3>
          <p className="mt-1">
            [App name] (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates this app. Contact us at [contact email]
            for any privacy questions or requests.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Information we collect</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Account info: email, username, password (hashed), profile photo, bio.</li>
            <li>Content you post: photos, videos, and stories (stories are deleted automatically after 24 hours).</li>
            <li>Messages: direct message text and any images you send in chat.</li>
            <li>Dating profile (optional, 18+ only): a bio and your like/match activity. Confirming you are 18+ is required before this feature can be enabled and is recorded with a timestamp.</li>
            <li>Verification applications (optional): your legal name, a photo of a government ID, and payment proof. These are stored in a private, non-public location and are automatically deleted once your application is reviewed — we keep only the decision, not the documents.</li>
            <li>Usage data: device/push notification token, basic diagnostic and log data.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">How we use it</h3>
          <p className="mt-1">
            To operate core features (feed, stories, chat, dating, notifications), to review
            verification applications, to moderate content against our community guidelines,
            and to keep the app safe (e.g. acting on reports and strikes).
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Automated content moderation</h3>
          <p className="mt-1">
            Photos and videos you upload are automatically scanned by an automated
            moderation service (Sightengine) before appearing publicly, to detect
            content that violates our community guidelines. Flagged content may be
            removed and may result in an account strike.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Who we share it with</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>[Supabase] — hosts our database, authentication, and file storage.</li>
            <li>[OneSignal] — delivers push notifications.</li>
            <li>Sightengine — scans uploaded images/video for policy violations.</li>
            <li>We do not sell your personal information.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Data retention</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Stories: deleted automatically 24 hours after posting.</li>
            <li>Chat images: stored privately and only viewable by the two participants of that conversation.</li>
            <li>Verification documents (ID photo, payment proof): deleted automatically as soon as your application is reviewed.</li>
            <li>Other content and account data: retained until you delete it or close your account.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Your choices</h3>
          <p className="mt-1">
            You can edit or delete your posts, stories, and messages, disable your dating
            profile at any time, and request deletion of your account and associated data
            by contacting [contact email].
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Age requirements</h3>
          <p className="mt-1">
            This app is not directed at children. You must meet the minimum age required
            by your country to create an account. The dating feature additionally requires
            you to confirm you are 18 or older before you can use it.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Changes to this policy</h3>
          <p className="mt-1">
            We&rsquo;ll update the &ldquo;last updated&rdquo; date above if this policy changes, and post
            material changes in the app.
          </p>
        </section>
      </div>
    </div>
  );
}
