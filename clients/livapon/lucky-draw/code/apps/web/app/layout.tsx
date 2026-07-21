import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, EB_Garamond } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavLink } from "../components/NavLink";
import { SearchPill } from "../components/SearchPill";
import { CategoryRow } from "../components/CategoryRow";
import { getSession } from "../lib/auth/current-session";
import { getMyRoles, isOperator } from "../lib/auth/roles";
import { headers } from "next/headers";
import { PATHNAME_HEADER } from "../lib/pathname-header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-jp",
  display: "swap"
});

// Serif "voice" face — used only for hero/membership copy (DESIGN.md §4).
// First choice is Adobe Garamond Pro, which has no embeddable web licence;
// EB Garamond (Google, open source) is the interim Garamond revival stand-in.
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap"
});

export const metadata: Metadata = {
  title: "LIVAPON Academy",
  description: "Learn a Japanese craft from the makers who kept it — courses, and experiences that open once you finish."
};

// Hidden entirely for non-operators, not just guarded on click — the link
// itself must not be discoverable in the DOM for a customer account.
async function OperatorNavLink() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const roles = await getMyRoles();
  if (!isOperator(roles)) {
    return null;
  }
  return <NavLink href="/operator/bookings">Operator</NavLink>;
}

async function AuthControl() {
  const session = await getSession();
  if (!session) {
    return <a href="/api/auth/login">Log in</a>;
  }
  return (
    <>
      {session.email ? <span className="meta">{session.email}</span> : null}
      <a href="/api/auth/logout">Log out</a>
    </>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get(PATHNAME_HEADER) ?? "";
  // Standalone campaign microsites (e.g. the Japan Festival raffle) render
  // their own minimal chrome — no Academy header/search/nav (spec:
  // docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md §6).
  const isStandaloneCampaign = pathname.startsWith("/raffle/");

  return (
    <html lang="en" className={`${inter.variable} ${notoSansJp.variable} ${ebGaramond.variable}`}>
      <body>
        {isStandaloneCampaign ? (
          children
        ) : (
          <div className="shell">
            <header className="topbar">
              <Link className="brand" href="/">
                LIVAPON <span>Academy</span>
              </Link>
              <SearchPill />
              <nav className="nav" aria-label="Primary navigation">
                <NavLink href="/courses">Courses</NavLink>
                <NavLink href="/experiences">Experiences</NavLink>
                <NavLink href="/me">My Page</NavLink>
                <OperatorNavLink />
                <AuthControl />
              </nav>
            </header>
            <CategoryRow />
            <main className="main">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
