import { getSettings } from '@/lib/settings';
import { activeProvider } from '@/lib/ai';
import Chat from '@/components/Chat';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { tz } = await getSettings();
  return <Chat tz={tz} provider={activeProvider()} />;
}
