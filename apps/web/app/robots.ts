import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/** Everything public may be read, by people and by agents; only the JSON API is kept out of indexes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
