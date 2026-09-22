import { LegalPage, Section, Bullets, SupportLink } from "./LegalSection";

export default function PrivacyPolicyView() {
  return (
    <LegalPage title="Privacy Policy" updated="September 21, 2026">
      <Section title="Who we are">
        <p>
          Next Social (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by Xchordlabs LLC. For any privacy question or
          request, including access or deletion, contact <SupportLink />.
        </p>
      </Section>

      <Section title="Information we collect">
        <Bullets
          items={[
            "Account information: email address, username, password (stored hashed by our authentication provider), display name, profile photo, bio, and — only if you choose to give them — location text and age.",
            "Content you create: photos, videos, carousels and text posts, stories (deleted after 24 hours), captions, comments, likes, saves and emoji reactions.",
            "Messages: text, images and voice notes you send in chats. Messages are private to the people in the conversation but are not end-to-end encrypted.",
            "Dating (optional, 18+): your age, a short bio, and your likes and matches. Dating can only be turned on if your profile age is 18 or older, and age can only be set once.",
            "Verification applications (optional): your legal name, a photo of an ID document and payment proof. The images are deleted once the application is reviewed; we keep only the decision.",
            "AI features: the topic you enter for caption suggestions and the messages you send to the AI assistant are sent to our AI provider to generate a reply.",
            "Gallery: search words you type in the wallpaper gallery are sent to the Wallhaven service.",
            "Safety reports: when you report something, we store your report and a copy of what was reported (for a chat report, the last few messages) so our team can review it.",
            "Activity and device data: a push-notification token, a \"last seen\" time (visible to people you chat with), and routine technical logs from our hosting provider.",
          ]}
        />
        <p>We do not collect your precise GPS location, contacts or advertising identifiers, and we do not show ads.</p>
      </Section>

      <Section title="How we use it">
        <p>
          To run the app (feed, stories, chat, dating, notifications), to review verification applications, to keep the
          community safe (reviewing reports, removing content, issuing strikes and suspending accounts), to prevent
          abuse and spam, and to fix problems.
        </p>
      </Section>

      <Section title="Moderation">
        <p>
          Our team reviews reports and may remove content, issue strikes or suspend accounts that break our{" "}
          <a href="/terms" className="text-brand-from underline">
            Community Guidelines
          </a>
          . You can see and appeal strikes in the app under Account health. We may add automated content scanning in the
          future and will update this policy if we do.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>We do not sell your personal data. We use these service providers to run the app:</p>
        <Bullets
          items={[
            "Supabase — database, sign-in, real-time messaging and storage for avatars, chat media and verification documents.",
            "Cloudflare (R2) — storage and delivery of post and story photos and videos.",
            "Vercel — hosting of the website and app servers.",
            "OneSignal — delivery of push notifications.",
            "OpenRouter and its AI model providers — generating AI captions and AI assistant replies.",
            "Wallhaven — wallpaper search in the gallery.",
          ]}
        />
        <p>
          Posts, stories, comments and your public profile are visible to other people using the app. We may disclose
          information if required by law or to protect people&rsquo;s safety.
        </p>
      </Section>

      <Section title="How long we keep it">
        <Bullets
          items={[
            "Stories are removed after 24 hours; their files are cleaned up shortly after.",
            "Posts, comments and messages stay until you or the other person delete them. When content is deleted its files are removed from storage, normally within a day.",
            "When you delete your account, your profile, posts, stories, comments, messages, matches, reports involving you and uploaded files are permanently deleted right away. Backups kept by our providers are overwritten on their normal schedule.",
            "Verification documents are deleted when the application is reviewed.",
          ]}
        />
      </Section>

      <Section title="Your choices and rights">
        <Bullets
          items={[
            "Delete your account any time: Menu → Settings → Delete account, or see our account deletion page.",
            "Edit your profile, turn read receipts off, require approval for followers, and block or report people in the app.",
            "Ask us for a copy of your data, or a correction, at the email above. Depending on where you live you may have further rights (for example under GDPR or CCPA) and we will honour them.",
          ]}
        />
        <p>
          You can also review the{" "}
          <a href="/delete-account" className="text-brand-from underline">
            account deletion page
          </a>
          .
        </p>
      </Section>

      <Section title="Children">
        <p>
          Next Social is not for children under 13, and we do not knowingly collect their data. Dating features are for
          adults (18+) only. If you believe a child under 13 has an account, contact <SupportLink /> and we will
          remove it.
        </p>
      </Section>

      <Section title="Security and international processing">
        <p>
          We use encryption in transit and access controls on our database. No system is perfectly secure. Our
          providers may process data in countries other than yours.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we make important changes to this policy we will update the date above and, where appropriate, tell you in
          the app.
        </p>
      </Section>
    </LegalPage>
  );
}
