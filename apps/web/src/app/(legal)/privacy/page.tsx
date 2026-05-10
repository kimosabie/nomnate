import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — NomNate" };

export default function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-slate text-sm">Last updated: 10 May 2026</p>

      <p>
        NomNate (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your personal
        information in accordance with the <strong>Protection of Personal Information Act, 2013
        (POPIA)</strong> of South Africa. This policy explains what information we collect, why we
        collect it, and how we protect it.
      </p>

      <h2>1. Who we are</h2>
      <p>
        NomNate is a family meal-planning application built and operated in South Africa.
        For any privacy-related queries, contact us at{" "}
        <a href="mailto:privacy@nomnate.co.za">privacy@nomnate.co.za</a>.
      </p>

      <h2>2. Information we collect</h2>
      <p>We collect only what is necessary to provide the service:</p>
      <ul>
        <li><strong>Account information</strong> — your email address and password (stored securely via Supabase Auth).</li>
        <li><strong>Family profile</strong> — family name, member names, dietary restrictions, cuisine preferences, ingredient likes and dislikes, and diet types you choose to enter.</li>
        <li><strong>Meal plan data</strong> — recipes saved, meal plans generated, votes cast, and shopping lists created within your family group.</li>
        <li><strong>Feedback</strong> — messages submitted via the in-app feedback widget (type, message text, and the page you were on).</li>
        <li><strong>Usage data</strong> — standard server logs including IP address, browser type, and pages visited. We do not use third-party analytics trackers.</li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To provide and improve the NomNate service.</li>
        <li>To generate AI meal suggestions — we send <strong>dietary preferences only</strong> (no names, email addresses, or other identifying information) to the Anthropic Claude API.</li>
        <li>To search for recipes via the Spoonacular API — only ingredient and cuisine terms are sent.</li>
        <li>To process payments for Premium subscriptions via PayFast — we do not store card details.</li>
        <li>To respond to feedback and support requests.</li>
      </ul>

      <h2>4. Third-party services</h2>
      <p>We use the following sub-processors, each bound by their own privacy terms:</p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication (servers in the United States; EU-standard data agreements apply).</li>
        <li><strong>Anthropic</strong> — AI meal suggestions (United States). Only anonymised dietary preference data is transmitted.</li>
        <li><strong>Spoonacular</strong> — recipe search (United States). Only ingredient and cuisine terms are transmitted.</li>
        <li><strong>PayFast</strong> — payment processing (South Africa). Card data is handled exclusively by PayFast.</li>
        <li><strong>Vercel</strong> — application hosting (United States).</li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We retain your personal information for as long as your account is active. When you delete
        your account, we permanently delete your profile, family data, meal plans, and shopping
        lists within 30 days. Anonymised aggregate usage data may be retained for service improvement.
      </p>

      <h2>6. Your rights under POPIA</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Request correction of inaccurate information.</li>
        <li>Request deletion of your account and all associated data.</li>
        <li>Object to the processing of your personal information.</li>
        <li>Lodge a complaint with the <strong>Information Regulator of South Africa</strong> at{" "}
          <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">inforegulator.org.za</a>.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email us at{" "}
        <a href="mailto:privacy@nomnate.co.za">privacy@nomnate.co.za</a>. We will respond within
        30 days.
      </p>

      <h2>7. Security</h2>
      <p>
        All data is transmitted over HTTPS. Passwords are hashed and never stored in plain text.
        Database access is protected by row-level security policies. We conduct regular security
        reviews and will notify you of any breach affecting your personal information as required
        by POPIA.
      </p>

      <h2>8. Children</h2>
      <p>
        NomNate is intended for use by adults (18+) managing their family household. We do not
        knowingly collect personal information from children under 18 without parental consent.
        Children&apos;s dietary preferences entered by a parent or guardian are treated as household
        data and are not attributed to the child directly.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will notify you of material changes via
        email or an in-app notice. Continued use of NomNate after changes constitutes acceptance
        of the updated policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or concerns? Email{" "}
        <a href="mailto:privacy@nomnate.co.za">privacy@nomnate.co.za</a>.
      </p>
    </>
  );
}
