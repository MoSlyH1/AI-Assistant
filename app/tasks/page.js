import { getSettings } from '@/lib/settings';
import TasksView from '@/components/Tasks';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const { tz } = await getSettings();
  return <TasksView tz={tz} />;
}
