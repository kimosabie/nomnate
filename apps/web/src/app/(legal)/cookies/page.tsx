import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy — NomNate" };

export default function CookiePolicy() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-slate text-sm">Last updated: 10 May 2026</p>

      <p>
        This policy explains how NomNate uses cookies and similar technologies. We keep this
        simple — we use the minimum cookies necessary to run the Service.
      </p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device by your browser. They allow websites
        to remember information between page visits.
      </p>

      <h2>2. Cookies we use</h2>
      <p>NomNate uses only <strong>strictly necessary</strong> cookies:</p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-cream-border">
            <th className="text-left py-2 pr-4 font-semibold">Cookie</th>
            <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
            <th className="text-left py-2 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-cream-border">
            <td className="py-2 pr-4 font-mono text-xs">sb-access-token</td>
            <td className="py-2 pr-4">Keeps you signed in (Supabase Auth)</td>
            <td className="py-2">1 hour</td>
          </tr>
          <tr className="border-b border-cream-border">
            <td className="py-2 pr-4 font-mono text-xs">sb-refresh-token</td>
            <td className="py-2 pr-4">Refreshes your session automatically (Supabase Auth)</td>
            <td className="py-2">60 days</td>
          </tr>
          <tr>
            <td className="py-2 pr-4 font-mono text-xs">sb-auth-token</td>
            <td className="py-2 pr-4">Secure session identifier (Supabase Auth)</td>
            <td className="py-2">Session</td>
          </tr>
        </tbody>
      </table>

      <h2>3. What we do not use</h2>
      <ul>
        <li>No advertising or tracking cookies.</li>
        <li>No third-party analytics cookies (Google Analytics, Facebook Pixel, etc.).</li>
        <li>No cross-site tracking of any kind.</li>
      </ul>

      <h2>4. Managing cookies</h2>
      <p>
        The cookies listed above are required for NomNate to function. If you disable them in
        your browser you will not be able to stay signed in.
      </p>
      <p>
        You can clear all cookies at any time through your browser settings. This will sign you
        out of NomNate.
      </p>

      <h2>5. Changes to this policy</h2>
      <p>
        If we introduce new cookies in future (for example, for optional analytics), we will
        update this policy and inform you before setting them.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions? Email <a href="mailto:privacy@nomnate.co.za">privacy@nomnate.co.za</a>.
      </p>
    </>
  );
}
