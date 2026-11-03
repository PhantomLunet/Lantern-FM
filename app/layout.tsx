import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { DM_Sans, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-dm-sans', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fraunces', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'Lantern.fm — Ambient Radio for Late-Night Coders',
  description:
    'A cinematic ambient radio platform designed for late-night coders, creatives, indie hackers, writers, and deep-focus builders. Lo-fi beats, jazz café vibes, rain + piano, and more.',
  generator: 'Next.js',
  keywords: [
    'lofi',
    'ambient',
    'radio',
    'coding music',
    'focus music',
    'study music',
    'jazz',
    'synthwave',
    'lo-fi beats',
    'ambient sounds',
  ],
  authors: [{ name: 'Lantern.fm' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Lantern.fm — Ambient Radio for Late-Night Coders',
    description:
      'A cinematic ambient radio platform for deep focus and creativity.',
    type: 'website',
    siteName: 'Lantern.fm',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lantern.fm — Ambient Radio for Late-Night Coders',
    description:
      'A cinematic ambient radio platform for deep focus and creativity.',
  },
  icons: {
    icon: [
      {
        url: '/Lantern.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/Lantern.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/Lantern.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/Lantern.png',
  },
}


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050d1a' },
    { media: '(prefers-color-scheme: light)', color: '#FAF5EC' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable} bg-[#050d1a]`}>
      <body className="font-sans antialiased overflow-hidden">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
