import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
  title: "Privacy Policy — Astute Academy",
  description: "How Astute Academy protects children's data and respects families' privacy.",
};

const BODY = `Astute Academy is built for children, so privacy and data minimization are part of the design — not an afterthought. This policy explains what we collect, why, and the choices you have. It is written in plain language; if anything is unclear, contact us.

## Who holds the account

The parent or guardian is the account holder and the consent holder. Children do not create their own accounts and cannot sign up themselves. A parent adds a child as a profile under their own account and controls it.

## What we collect about a child

We deliberately collect the minimum needed to teach math:

- A first name or nickname (your choice — no last name required)
- The curriculum and grade level you select
- Practice activity: which questions were answered, whether each was correct, and timing, used to place the child and schedule review

We do NOT collect a child's full date of birth, last name, home address, photos, or any sensitive personal information. We do not require any of those to use the product.

## What we collect about a parent

To run your account we store your email address and authentication details (handled by our authentication provider) and a subscription status. We use your email to operate the service and, where you have agreed, to send account-related messages.

## How we use data

- To place each child at the right level and personalize daily practice
- To show you progress (mastery, streaks, accuracy)
- To improve question quality through aggregate, de-identified analysis
- To operate, secure, and maintain the service

We do not sell personal information, and we do not show third-party advertising to children.

## Telegram (optional)

If you choose to link Telegram for daily practice, we store the chat identifier needed to deliver questions to that chat. You can unlink at any time.

## Children's privacy (COPPA, GDPR-K and similar)

Because we serve families in the US, the EU, and elsewhere, we design for children's privacy laws including COPPA (US) and the GDPR provisions for children (EU). The parent provides consent and controls the child's data. We collect only what is necessary for the educational service.

## Your choices and rights

- Access or correct your child's profile from the parent dashboard
- Delete a child profile, which removes that child's associated practice data
- Delete your account and associated data by contacting us
- Where local law provides additional rights (access, portability, erasure), you may exercise them by contacting us

## Data storage and security

Account and learning data is stored with our database provider using access controls so that a parent can only access their own children's records. We take reasonable measures to protect data, though no system is perfectly secure.

## Changes to this policy

We may update this policy as the product evolves. Material changes will be communicated through the service.

## Contact

For any privacy question or request, contact the account email associated with Astute Academy.

This page is a product privacy policy and not legal advice. Before any public launch, have a qualified professional review the consent flow and this policy for your jurisdictions.`;

export default function Privacy() {
  return (
    <MarketingShell>
      <div className="content-wrap article">
        <h1>Privacy Policy</h1>
        <p className="blog-meta">Last updated: June 2026</p>
        <Markdown content={BODY} />
      </div>
    </MarketingShell>
  );
}
