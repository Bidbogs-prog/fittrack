import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata = { title: "Refund policy" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund policy">
      <p>
        {SITE_NAME} Premium is a digital subscription. This policy explains cancellation and refunds. Contact:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel a recurring subscription at any time. You keep Premium until the end of the period you already
        paid for, and you won&rsquo;t be charged again. Prepaid passes simply end on their expiry date.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>First purchase: if Premium isn&rsquo;t for you, ask within 14 days of paying for a full refund.</li>
        <li>Renewals: we refund a renewal if you contact us within 7 days of the charge and haven&rsquo;t used Premium features since.</li>
        <li>Technical problems that stop Premium from working are always refunded for the affected period.</li>
      </ul>
      <p>
        Where a payment partner sells to you as merchant of record, its refund process applies as well, and your
        statutory consumer rights are never reduced by this policy.
      </p>

      <h2>How to ask</h2>
      <p>Email us from your account address with the date of the charge. We reply within 5 working days.</p>
    </LegalPage>
  );
}
