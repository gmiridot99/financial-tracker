import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Financial Life Planner',
  description: 'Personal financial management connecting monthly habits to long-term life goals',
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
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#231D19',
                color: '#FAFAF8',
                border: '1px solid #2A2420',
              },
              success: {
                iconTheme: {
                  primary: '#66BB6A',
                  secondary: '#FAFAF8',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF6C4D',
                  secondary: '#FAFAF8',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
