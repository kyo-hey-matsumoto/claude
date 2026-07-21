import { apiFetch } from "../../../../lib/api";
import { OperatorNav } from "../../operator-nav";
import { PageHeader } from "../../../../components/PageHeader";
import { TableRegion } from "../../../../components/TableRegion";
import { EmptyState } from "../../../../components/EmptyState";

type RaffleEntry = {
  serialNumber: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  marketingOptIn: boolean;
};

export default async function OperatorRaffleEntriesPage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign: campaignCode } = await params;
  const entries = await apiFetch<RaffleEntry[]>(`/operator/raffle/${campaignCode}/entries`);

  return (
    <>
      <OperatorNav />
      <PageHeader
        title={<span lang="ja">福引応募一覧（{campaignCode}）</span>}
        lede={<a href={`/operator/raffle/${campaignCode}/entries.csv`}>CSVをダウンロード</a>}
      />
      {entries.length === 0 ? (
        <EmptyState>応募がまだありません。</EmptyState>
      ) : (
        <TableRegion label="福引応募一覧">
          <table>
            <thead>
              <tr>
                <th>番号</th>
                <th>メール</th>
                <th>氏名</th>
                <th>電話</th>
                <th>メルマガ同意</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.serialNumber}>
                  <td>{campaignCode}-{String(entry.serialNumber).padStart(6, "0")}</td>
                  <td>{entry.email}</td>
                  <td>
                    {entry.firstName ?? ""} {entry.lastName ?? ""}
                  </td>
                  <td>{entry.phone ?? "-"}</td>
                  <td>{entry.marketingOptIn ? "○" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </>
  );
}
