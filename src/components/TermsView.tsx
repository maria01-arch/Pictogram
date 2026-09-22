import { LegalPage, Section, Bullets, SupportLink } from "./LegalSection";

export default function TermsView() {
  return (
    <LegalPage title="Terms & Community Guidelines" updated="September 21, 2026">
      <Section title="1. Agreeing to these terms">
        <p>
          By creating an account or using Next Social you agree to these terms, our{" "}
          <a href="/privacy-policy" className="text-brand-from underline">
            Privacy Policy
          </a>{" "}
          and the Community Guidelines below. If you don&rsquo;t agree, please don&rsquo;t use the app.
        </p>
      </Section>

      <Section title="2. Who can use it">
        <p>
          You must be at least 13 years old. Dating features are only for people who are 18 or older. You are
          responsible for your account and for keeping your password safe. Give accurate information and don&rsquo;t
          pretend to be someone else.
        </p>
      </Section>

      <Section title="3. Your content">
        <p>
          You own what you post. By posting you give us a non-exclusive, worldwide licence to store, display and
          distribute it inside the service so the app can work. You are responsible for your content and confirm you
          have the right to share it.
        </p>
      </Section>

      <Section title="4. Community Guidelines — zero tolerance">
        <p>The following is not allowed anywhere in the app (posts, stories, comments, profiles, messages, dating):</p>
        <Bullets
          items={[
            "Any sexual content involving minors, or content that sexualises or endangers children. We remove it immediately and report it to the authorities.",
            "Nudity, pornography and sexually explicit content.",
            "Harassment, bullying, threats, stalking or sharing someone's private information.",
            "Hate speech or attacks on people because of race, ethnicity, religion, gender, sexuality, disability or similar traits.",
            "Graphic violence, terrorism, or content that promotes self-harm or suicide.",
            "Illegal activity, scams, fraud, spam, fake accounts and impersonation.",
            "Content you don't have the rights to share, including copyright infringement.",
          ]}
        />
        <p>Be kind. If in doubt, don&rsquo;t post it.</p>
      </Section>

      <Section title="5. Reporting and blocking">
        <p>
          You can report any post, comment, story, profile or chat from the ⋯ menu or the Report button, and you can
          block anyone from their profile. Blocked people can&rsquo;t message, follow or comment on you and you
          won&rsquo;t see their content. Manage blocked accounts in Menu → Privacy.
        </p>
      </Section>

      <Section title="6. What happens when rules are broken">
        <p>
          We review reports and may remove content, issue a strike, suspend an account or remove it permanently,
          depending on how serious the violation is. Serious violations can lead to immediate removal without warning.
          Every strike is listed in Menu → Account health, where you can appeal it and read the reviewer&rsquo;s reply.
        </p>
      </Section>

      <Section title="7. Dating">
        <p>
          Dating is opt-in and 18+. Be respectful, be honest about who you are, and don&rsquo;t ask for money or send
          unwanted sexual content. Report anyone who makes you uncomfortable. Meeting people online carries risk —
          take care when meeting someone in person.
        </p>
      </Section>

      <Section title="8. AI features">
        <p>
          Our AI assistant and caption helper can be wrong or inappropriate. They are not professional advice. Don&rsquo;t
          share sensitive personal information with them. What you send is processed by our AI provider (see the Privacy
          Policy).
        </p>
      </Section>

      <Section title="9. Verification badge">
        <p>
          A verification badge means we reviewed an application. It is not an endorsement of the person or their
          content. We may remove a badge if the rules are broken or the information turns out to be false.
        </p>
      </Section>

      <Section title="10. Ending your use">
        <p>
          You can delete your account at any time in Menu → Settings → Delete account. We may suspend or end accounts
          that break these terms or put others at risk.
        </p>
      </Section>

      <Section title="11. Service and liability">
        <p>
          The app is provided &ldquo;as is&rdquo;. We work hard to keep it running but can&rsquo;t promise it will always be
          available or error-free. To the extent the law allows, we are not liable for indirect or consequential
          losses arising from your use of the app. Nothing here limits rights you have under the law where you live.
        </p>
      </Section>

      <Section title="12. Changes and contact">
        <p>
          We may update these terms; if the changes are important we&rsquo;ll let you know in the app. Questions or
          concerns: <SupportLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
