import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
  title: "Terms of Service — Kareem",
  description: "The terms for using Kareem.",
};

const BODY = `These terms govern your use of Kareem. By creating an account you agree to them. Please read them alongside our Privacy Policy.

## The service

Kareem provides curriculum-aligned math placement and daily practice for children in grades 1–8. Features may change as we improve the product.

## Accounts

You must be an adult (a parent or legal guardian) to create an account, and you are responsible for activity under it and for the children's profiles you add. Keep your login credentials secure.

## Acceptable use

- Use the service for its intended educational purpose
- Do not attempt to disrupt, reverse engineer, or gain unauthorized access to the service
- Do not use the service to collect data about other users

## Educational content

We work to keep questions accurate and age-appropriate; every question is reviewed before it is served. Even so, the service is a study aid and is not a substitute for school instruction. We make no guarantee of any particular educational outcome.

## Subscriptions

The service may be offered free during a trial period and paid thereafter. Pricing and billing terms will be presented clearly before any charge.

## Availability

We aim for reliable service but do not guarantee uninterrupted availability. We may modify or discontinue features.

## Termination

You may stop using the service and delete your account at any time. We may suspend accounts that violate these terms.

## Disclaimers and liability

The service is provided "as is." To the extent permitted by law, we disclaim warranties and limit our liability for indirect or consequential damages.

## Changes

We may update these terms; continued use after an update means you accept the revised terms.

This page is a product terms summary and not legal advice. Have a qualified professional review terms before any public launch.`;

export default function Terms() {
  return (
    <MarketingShell>
      <div className="content-wrap article">
        <h1>Terms of Service</h1>
        <p className="blog-meta">Last updated: June 2026</p>
        <Markdown content={BODY} />
      </div>
    </MarketingShell>
  );
}
