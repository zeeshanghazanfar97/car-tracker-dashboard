import VehicleHistoryView from "@/components/vehicle-history-view";

export default async function VehiclePage({
  params
}: {
  params: Promise<{ plate: string }>;
}) {
  const { plate } = await params;
  return <VehicleHistoryView plate={plate} />;
}
