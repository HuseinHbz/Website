import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { getPublicBlogPostBySlug, getPublicBlogPostNav, getPublicBlogPosts } from '@/lib/publicData'
import { articleSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { BlogPostView } from './BlogPostView'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// SEO fix — every published post gets its own /en and /fa static path
// pre-rendered at build time instead of the old client-fetch-on-mount
// pattern (empty HTML until JS runs = nothing for crawlers/link-unfurlers
// that don't execute JS, and no per-post <title>/description/canonical).
export async function generateStaticParams() {
  const posts = (await getPublicBlogPosts()) ?? []
  const locales = ['en', 'fa']
  return locales.flatMap(locale => posts.map(p => ({ locale, slug: p.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const post = await getPublicBlogPostBySlug(slug)
  if (!post) return {}
  const isRTL = locale === 'fa'
  const title = isRTL ? post.titleFa : post.titleEn
  const description = (isRTL ? post.excerptFa : post.excerptEn) || undefined
  const image = post.coverImage || `${SITE.url}/og-image.png`
  const url = `${SITE.url}/${locale}/blog/${slug}`

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE.url}/en/blog/${slug}`,
        fa: `${SITE.url}/fa/blog/${slug}`,
      },
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  const post = await getPublicBlogPostBySlug(slug)
  if (!post) notFound()

  const { prev, next } = await getPublicBlogPostNav(post.id)
  const isRTL = locale === 'fa'
  const url = `${SITE.url}/${locale}/blog/${slug}`

  return (
    <>
      <JsonLd schema={articleSchema({
        title: isRTL ? post.titleFa : post.titleEn,
        description: (isRTL ? post.excerptFa : post.excerptEn) || '',
        url,
        // The schema published/modified fields want a real timestamp — the
        // display strings (publishedAtEn/Fa) are locale-formatted for humans
        // ("Aug 2025"), not machine-parseable, so createdAt/updatedAt (the
        // real DB timestamps, already ISO-formatted by tsNow()) are used here.
        datePublished: post.createdAt,
        dateModified: post.updatedAt,
        image: post.coverImage || undefined,
      })} />
      <BlogPostView
        post={{
          id: post.id,
          slug: post.slug,
          titleEn: post.titleEn,
          titleFa: post.titleFa,
          excerptEn: post.excerptEn,
          excerptFa: post.excerptFa,
          contentEn: post.contentEn,
          contentFa: post.contentFa,
          readTimeEn: post.readTimeEn,
          readTimeFa: post.readTimeFa,
          publishedAtEn: post.publishedAtEn,
          publishedAtFa: post.publishedAtFa,
          categoryId: post.categoryId,
          categoryNameEn: post.categoryNameEn ?? undefined,
          categoryNameFa: post.categoryNameFa ?? undefined,
          categoryColor: post.categoryColor ?? undefined,
          prev,
          next,
        }}
        locale={locale}
      />
    </>
  )
}
