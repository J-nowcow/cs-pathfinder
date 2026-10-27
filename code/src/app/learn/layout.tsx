import { LibraryAccountProvider } from '@/components/library/LibraryAccount'
export default function LearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LibraryAccountProvider
      enabled={process.env.LIBRARY_ACCOUNT_SYNC_ENABLED === '1'}
    >
      {children}
    </LibraryAccountProvider>
  )
}
