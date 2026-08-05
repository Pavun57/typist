import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Typist — Type with your voice. Anywhere.',
  description:
    'Typist is a free, open-source push-to-talk voice assistant. Dictate in 99+ languages, run voice commands, teach it memory, and get screen-aware coding help — cloud or fully offline.',
  openGraph: {
    title: 'Typist — Type with your voice. Anywhere.',
    description:
      'Free, open-source voice typing with commands, memory, and screen-aware coding help. Linux · macOS · Windows.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
