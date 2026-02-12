import { ZipDashboardShell } from "../../../components/zip-dashboard-shell";

interface ZipDashboardPageProps {
  params: Promise<{
    zip: string;
  }>;
}

export default async function ZipDashboardPage({ params }: ZipDashboardPageProps) {
  const { zip } = await params;

  return <ZipDashboardShell zipParam={zip} />;
}
