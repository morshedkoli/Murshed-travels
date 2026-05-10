import { getReportSnapshot } from '@/actions/reports';
import { ReportsManager } from '@/components/reports/reports-manager';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
    const report = await getReportSnapshot();

    return (
        <div className="space-y-5">
            <ReportsManager initialReport={report} />
        </div>
    );
}
