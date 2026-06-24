import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'Content' }

interface ContentSectionProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  count?: number
}

function ContentSection({ title, description, href, icon, count }: ContentSectionProps) {
  return (
    <Link
      href={href}
      className="block p-6 bg-surface border border-border rounded-xl hover:border-accent/30 transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent group-hover:bg-accent/20 transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {count !== undefined && (
              <span className="text-sm font-medium text-text-muted">{count} items</span>
            )}
          </div>
          <p className="text-sm text-text-muted mt-1">{description}</p>
        </div>
        <svg className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

export default async function ContentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Manage posts, services, and other content."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ContentSection
          title="Posts"
          description="Blog posts and articles in Persian and English."
          href="/content/posts"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />

        <ContentSection
          title="Services"
          description="Service offerings with descriptions and icons."
          href="/content/services"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          }
        />
      </div>
    </div>
  )
}
