import { apiFetchText } from "../../../../../lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  const csv = await apiFetchText(`/operator/raffle/${campaign}/entries.csv`);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${campaign}-raffle-entries.csv"`
    }
  });
}
