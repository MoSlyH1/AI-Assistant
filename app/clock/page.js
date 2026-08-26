import { getSettings } from '@/lib/settings';
import ClockView from '@/components/Clock';

export const dynamic = 'force-dynamic';

export default async function ClockPage() {
  const { tz } = await getSettings();
  return <ClockView tz={tz} />;
}
