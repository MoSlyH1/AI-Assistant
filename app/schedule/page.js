import { getSettings } from '@/lib/settings';
import ScheduleView from '@/components/Schedule';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const { tz } = await getSettings();
  return <ScheduleView tz={tz} />;
}
