import { NavLink } from "../../components/NavLink";

export function OperatorNav() {
  return (
    <nav className="subnav" aria-label="Operator navigation" lang="ja">
      <NavLink href="/operator/bookings">予約一覧</NavLink>
      <NavLink href="/operator/webhooks">Webhook履歴</NavLink>
      <NavLink href="/operator/product-mappings">Shopify連携診断</NavLink>
      <NavLink href="/operator/raffle/ca26">福引応募一覧</NavLink>
    </nav>
  );
}
