import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** When VITE_SITE_URL is set (canonical app homepage, e.g. https://example.com/ or https://user.github.io/Moodie/), emit sitemap.xml and robots.txt with Sitemap: */
function viteSeoDistFiles(): import('vite').Plugin {
  return {
    name: 'vite-seo-dist-files',
    apply: 'build',
    closeBundle() {
      const home = process.env.VITE_SITE_URL?.trim()
      if (!home) return
      const dist = path.resolve(__dirname, 'dist')
      const normalized = home.endsWith('/') ? home : `${home}/`
      const sitemapHref = new URL('sitemap.xml', normalized).href
      const pageLoc = escapeXml(normalized)
      const robots = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapHref}\n`
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${pageLoc}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
      fs.writeFileSync(path.join(dist, 'robots.txt'), robots, 'utf8')
      fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap, 'utf8')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSeoDistFiles()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
