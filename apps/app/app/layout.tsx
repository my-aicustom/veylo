import '@/styles/globals.css';
import '@/styles/call-ux.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Veylo — Live multilingual conversation',
  description: 'Private multilingual video calling, face-to-face interpretation, and AI conversation practice.',
};

export const viewport: Viewport = { themeColor: '#0b0b0c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
