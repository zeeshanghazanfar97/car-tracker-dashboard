import TripMapView from "@/components/trip-map-view";

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function TripMapPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const plate = asString(params.plate) ?? "";
  const to = asString(params.to) ?? new Date().toISOString();
  const from = asString(params.from) ?? new Date(new Date(to).getTime() - 60 * 60 * 1000).toISOString();
  const snap = asString(params.snap) !== "false";

  return (
    <TripMapView
      initialPlate={plate}
      initialFrom={from}
      initialTo={to}
      initialSnap={snap}
    />
  );
}
