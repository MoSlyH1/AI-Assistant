import './globals.css';
import Shell from '@/components/Shell';
import { getSettings } from '@/lib/settings';

export const metadata = {
  title: 'Nimbus — your assistant',
  description: 'Chat, tasks, notes, schedule and clock in one place.',
};

export const viewport = {
  themeColor: '#0f1319',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }) {
  let tz = 'UTC';
  try { tz = (await getSettings()).tz; } catch { tz = 'UTC'; }
  return (
    <html lang="en">
      <body>
        <Shell tz={tz}>{children}</Shell>
      </body>
    </html>
  );
}
