import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, LEGAL_OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {SITE_NAME} is a nutrition tracker and AI coach operated by {LEGAL_OPERATOR} (&ldquo;we&rdquo;). This policy
        explains what we collect, why, who processes it for us, and your rights. Questions or requests:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> email, name, password (stored hashed by our auth provider) or your Google sign-in.</li>
        <li><strong>Profile:</strong> birth date, sex, height, weight, activity level, goal, units, language and fasting window — used to calculate your targets.</li>
        <li><strong>Health and activity logs:</strong> meals and portions, foods and recipes you create, saved meals, weight, water, exercise and steps.</li>
        <li><strong>AI features:</strong> text and voice transcripts you send to meal logging, meal photos you upload, and your conversations with the coach.</li>
        <li><strong>Usage records:</strong> for each AI request we store the feature, model and token counts (never the content) to enforce limits and track cost.</li>
        <li><strong>Product analytics and errors:</strong> pseudonymous events (for example &ldquo;meal logged&rdquo;) and crash reports. These never include what you ate, your body numbers or message content.</li>
      </ul>
      <p>
        Weight, body measurements and food intake can reveal information about your health. We treat all of it as
        sensitive data and use it only to provide the service to you.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the app: calculate targets, store your diary, show history and trends (performance of our contract with you).</li>
        <li>To provide AI features you ask for: parsing meals, coach replies, insights, reports and plans (your consent, given when you use the feature; you can stop at any time).</li>
        <li>To keep the service secure, within cost limits and working (our legitimate interest).</li>
      </ul>
      <p>We do not sell your data, show ads, or use your data to train AI models.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li><strong>Supabase</strong> — database, authentication and file storage.</li>
        <li><strong>Vercel</strong> — hosting.</li>
        <li><strong>LLM Gateway</strong> and <strong>Google (Gemini)</strong> — process the content of AI requests to generate a reply. We send the minimum context needed (for the coach: a summary of your targets and recent logs, not your full diary).</li>
        <li><strong>PostHog</strong> — product analytics. <strong>Sentry</strong> — error monitoring.</li>
        <li><strong>Open Food Facts</strong> — source of food data (we send nothing to them).</li>
      </ul>
      <p>
        Some of these providers process data outside Morocco and the EU. We rely on their contractual safeguards for
        international transfers.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your data stays as long as your account exists. Meal photos are sent to the AI for analysis and are not
        stored. Deleting your account permanently removes your profile, diary, logs, recipes, saved meals and coach
        conversations.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Access and export: download all your data from <strong>Me → Export</strong>.</li>
        <li>Correction: edit your profile and logs at any time.</li>
        <li>Deletion: <strong>Me → Delete account</strong> removes everything immediately.</li>
        <li>Objection, restriction and complaints: contact us. You may also complain to your data-protection authority (in Morocco the CNDP; in France the CNIL).</li>
      </ul>

      <h2>Age</h2>
      <p>
        {SITE_NAME} is for people aged 14 and over. If you are under 18 — or under the age of digital consent where
        you live (15 in France) — a parent or guardian must agree to your use. The AI coach is available only to
        adults (18+).
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use cookies to keep you signed in and remember your language, and local storage for offline logging and
        analytics. There are no advertising cookies.
      </p>

      <h2>Changes</h2>
      <p>We will update the date above and tell you in the app about significant changes.</p>
    </LegalPage>
  );
}
