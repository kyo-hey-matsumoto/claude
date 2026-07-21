import { redirect } from "next/navigation";
import { getRaffleCampaign, getRaffleWindowStatus, type RaffleCampaignConfig } from "@livapon/domain";
import { apiFetch, ApiError } from "../../../lib/api";
import { RaffleCountdown } from "../../../components/RaffleCountdown";

// Local/staging convenience: preview the OPEN state without waiting for the
// real campaign window. Must mirror RaffleService.resolveWindowStatus
// (apps/api/src/raffle/raffle.service.ts) so the client and server never
// disagree about whether entries are open.
function resolveWindowStatus(campaign: RaffleCampaignConfig) {
  if (process.env.NODE_ENV !== "production" && process.env.RAFFLE_PREVIEW_FORCE_OPEN === "true") {
    return "OPEN" as const;
  }
  return getRaffleWindowStatus(new Date(), campaign.opensAt, campaign.closesAt);
}

export default async function RaffleJoinPage({
  params,
  searchParams
}: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { campaign: campaignCode } = await params;
  const { error } = await searchParams;
  const campaign = getRaffleCampaign(campaignCode);

  if (!campaign) {
    return (
      <div className="raffle-page">
        <p className="raffle-logo">LIVAPON</p>
        <p>We couldn&apos;t find that raffle.</p>
      </div>
    );
  }

  const status = resolveWindowStatus(campaign);

  async function join(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const privacyConsent = formData.get("privacyConsent") === "on";
    const marketingOptIn = formData.get("marketingOptIn") === "on";

    try {
      const entry = await apiFetch<{ accessToken: string }>(`/raffle/${campaignCode}/entries`, {
        method: "POST",
        body: JSON.stringify({ email, privacyConsent, marketingOptIn })
      });
      redirect(`/raffle/${campaignCode}/entry/${entry.accessToken}`);
    } catch (err) {
      if (err instanceof ApiError) {
        redirect(`/raffle/${campaignCode}?error=1`);
      }
      throw err;
    }
  }

  return (
    <div className="raffle-page">
      <p className="raffle-logo">LIVAPON</p>
      {status === "BEFORE_OPEN" ? (
        <>
          <h1>Join the LIVAPON Japan Festival Raffle</h1>
          <p>Entries open in:</p>
          <RaffleCountdown target={campaign.opensAt.toISOString()} />
        </>
      ) : status === "CLOSED" ? (
        <>
          <h1>Entries are now closed</h1>
          <p>Thanks for your interest! Watch for the winners announcement at the festival.</p>
        </>
      ) : (
        <>
          <h1>Join the LIVAPON Japan Festival Raffle</h1>
          {error ? <p className="notice danger">Please check your details and agree to the terms below, then try again.</p> : null}
          <form className="raffle-form" action={join}>
            <label className="raffle-email-field" htmlFor="email">
              <span>Email address</span>
              <input id="email" name="email" type="email" required maxLength={320} />
            </label>
            <label className="raffle-checkbox">
              <input name="privacyConsent" type="checkbox" required />
              <span>
                By joining, you agree that LIVAPON may collect and use the information you provide to run this
                raffle and to deliver LIVAPON services.
              </span>
            </label>
            <label className="raffle-checkbox">
              <input name="marketingOptIn" type="checkbox" />
              <span>Yes, I&apos;d like to receive offers and updates from LIVAPON by email.</span>
            </label>
            <button className="button primary" type="submit">
              Join
            </button>
          </form>
        </>
      )}
    </div>
  );
}
