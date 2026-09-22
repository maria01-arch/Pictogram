import Link from "next/link";
import { LegalPage, Section, Bullets, SupportLink } from "@/components/LegalSection";

export const metadata = { title: "Delete your account — Next Social" };

// Public page (no login needed to read it) — Google Play requires a web address
// where people can find out how to delete their account and data.
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Next Social account">
      <Section title="Delete it yourself (fastest)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <Link href="/auth/login" className="text-brand-from underline">
              Log in
            </Link>{" "}
            to the app or website.
          </li>
          <li>Open Menu → Settings.</li>
          <li>Scroll to &ldquo;Delete account&rdquo;, tap &ldquo;Delete my account&rdquo;, type your username and confirm.</li>
        </ol>
        <p>Your account is deleted immediately.</p>
      </Section>

      <Section title="Can't log in?">
        <p>
          Email <SupportLink /> from the address you signed up with, with the subject &ldquo;Delete my account&rdquo;. We
          will verify it&rsquo;s you and delete the account within 30 days.
        </p>
      </Section>

      <Section title="What is deleted">
        <Bullets
          items={[
            "Your profile, username, photo and bio.",
            "All your posts, stories, comments, likes, saves and reactions.",
            "Your messages and chats, dating profile, likes and matches.",
            "Your uploaded photos, videos, voice notes and verification documents (files are removed from storage).",
            "Reports you made or that were made about you.",
          ]}
        />
        <p>
          Copies held in our providers&rsquo; routine backups are overwritten on their normal schedule. Some things may
          be kept if the law requires it (for example, evidence of illegal content that must be reported to the
          authorities).
        </p>
      </Section>

      <Section title="More information">
        <p>
          See our{" "}
          <Link href="/privacy-policy" className="text-brand-from underline">
            Privacy Policy
          </Link>{" "}
          for how we handle data.
        </p>
      </Section>
    </LegalPage>
  );
}
