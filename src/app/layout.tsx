import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import ResponsiveToaster from '@/components/ResponsiveToaster'

export const metadata: Metadata = {
  title: 'Financial Life Planner',
  description: 'Personal financial management connecting monthly habits to long-term life goals',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="bg-warmBg-primary text-warmText-primary">
        <AuthProvider>
          <AppLayout>
            {children}
          </AppLayout>
          <ResponsiveToaster />
        </AuthProvider>
      </body>
    </html>
  )
}
