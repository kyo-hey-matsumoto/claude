import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "../../../../../lib/api";
import { FormField } from "../../../../../components/FormField";

type RaffleEntry = {
  campaignCode: string;
  displayNumber: string;
  accessToken: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  marketingOptIn: boolean;
};

const PROFILE_TEXT_FIELDS = [
  "phone",
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country"
] as const;

export default async function RaffleEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ campaign: string; token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { campaign: campaignCode, token } = await params;
  const { saved } = await searchParams;

  let entry: RaffleEntry;
  try {
    entry = await apiFetch<RaffleEntry>(`/raffle/${campaignCode}/entries/${token}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return (
        <div className="raffle-page">
          <p className="raffle-logo">LIVAPON</p>
          <p>We couldn&apos;t find that entry. Please use the link from your confirmation email.</p>
        </div>
      );
    }
    throw err;
  }

  async function updateProfile(formData: FormData) {
    "use server";
    const body: Record<string, string | boolean> = {};
    for (const key of PROFILE_TEXT_FIELDS) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) {
        body[key] = value;
      }
    }
    body.marketingOptIn = formData.get("marketingOptIn") === "on";

    await apiFetch(`/raffle/${campaignCode}/entries/${token}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    redirect(`/raffle/${campaignCode}/entry/${token}?saved=1`);
  }

  return (
    <div className="raffle-page">
      <p className="raffle-logo">LIVAPON</p>
      <h1>You&apos;re in!</h1>
      <p className="raffle-number">{entry.displayNumber}</p>
      <p>Take a screenshot of this number to keep it handy for the draw.</p>
      {saved ? <p className="notice">Your details were saved.</p> : null}

      <section className="raffle-profile">
        <h2>Add a few more details</h2>
        <p>We&apos;ll get to know you better before the festival. Everything here is optional.</p>
        <form className="form-grid" action={updateProfile}>
          <FormField htmlFor="firstName" label="First name">
            <input id="firstName" name="firstName" defaultValue={entry.firstName ?? ""} />
          </FormField>
          <FormField htmlFor="lastName" label="Last name">
            <input id="lastName" name="lastName" defaultValue={entry.lastName ?? ""} />
          </FormField>
          <FormField htmlFor="phone" label="Phone">
            <input id="phone" name="phone" defaultValue={entry.phone ?? ""} />
          </FormField>
          <FormField htmlFor="gender" label="Gender">
            <input id="gender" name="gender" defaultValue={entry.gender ?? ""} />
          </FormField>
          <FormField htmlFor="dateOfBirth" label="Date of birth">
            <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={entry.dateOfBirth ?? ""} />
          </FormField>
          <FormField htmlFor="addressLine1" label="Address line 1">
            <input id="addressLine1" name="addressLine1" defaultValue={entry.addressLine1 ?? ""} />
          </FormField>
          <FormField htmlFor="addressLine2" label="Address line 2">
            <input id="addressLine2" name="addressLine2" defaultValue={entry.addressLine2 ?? ""} />
          </FormField>
          <FormField htmlFor="city" label="City">
            <input id="city" name="city" defaultValue={entry.city ?? ""} />
          </FormField>
          <FormField htmlFor="region" label="Province / State">
            <input id="region" name="region" defaultValue={entry.region ?? ""} />
          </FormField>
          <FormField htmlFor="postalCode" label="Postal code">
            <input id="postalCode" name="postalCode" defaultValue={entry.postalCode ?? ""} />
          </FormField>
          <FormField htmlFor="country" label="Country">
            <input id="country" name="country" defaultValue={entry.country ?? ""} />
          </FormField>
          <label className="raffle-checkbox">
            <input name="marketingOptIn" type="checkbox" defaultChecked={entry.marketingOptIn} />
            <span>Yes, I&apos;d like to receive offers and updates from LIVAPON by email.</span>
          </label>
          <button className="button primary" type="submit">
            Save details
          </button>
        </form>
      </section>
    </div>
  );
}
