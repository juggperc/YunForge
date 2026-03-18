import { load } from 'cheerio'

type SearchResult = {
  title: string
  url: string
  snippet: string
}

type SearchChunk = {
  sourceTitle: string
  sourceUrl: string
  chunkIndex: number
  score: number
  text: string
}

const SEARCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
const SEARCH_ACCEPT_LANGUAGE = 'en-US,en;q=0.9'
const SEARCH_TIMEOUT_MS = 15_000
const SEARCH_HOST_BLOCKLIST = new Set([
  'duckduckgo.com',
  'www.duckduckgo.com',
  'html.duckduckgo.com',
  'lite.duckduckgo.com',
  'links.duckduckgo.com',
  'external-content.duckduckgo.com',
])

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function decodeNestedUrl(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function unwrapDuckDuckGoRedirect(value: string) {
  let current = value

  for (let depth = 0; depth < 4; depth += 1) {
    try {
      const url = new URL(current)

      if (!SEARCH_HOST_BLOCKLIST.has(url.hostname)) {
        return url.toString()
      }

      const next =
        decodeNestedUrl(url.searchParams.get('uddg')) ||
        decodeNestedUrl(url.searchParams.get('u3')) ||
        decodeNestedUrl(url.searchParams.get('u'))

      if (!next || next === current) {
        return url.toString()
      }

      current = next
    } catch {
      return current
    }
  }

  return current
}

function decodeDuckDuckGoUrl(href: string) {
  try {
    const url = new URL(href, 'https://html.duckduckgo.com')
    return unwrapDuckDuckGoRedirect(url.toString())
  } catch {
    return href
  }
}

function isAllowedSearchResultUrl(value: string) {
  try {
    const url = new URL(value)

    if (
      url.searchParams.has('ad_domain') ||
      ((url.hostname === 'bing.com' || url.hostname === 'www.bing.com') &&
        url.pathname.includes('aclick'))
    ) {
      return false
    }

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !SEARCH_HOST_BLOCKLIST.has(url.hostname)
    )
  } catch {
    return false
  }
}

function tokenizeQuery(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  )
}

function chunkText(text: string, chunkSize: number, overlap: number) {
  const normalized = text
    .split(/\n{2,}/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of normalized) {
    if (paragraph.length > chunkSize) {
      if (current) {
        chunks.push(current)
        current = ''
      }

      let cursor = 0
      while (cursor < paragraph.length) {
        const slice = paragraph.slice(cursor, cursor + chunkSize).trim()

        if (slice) {
          chunks.push(slice)
        }

        if (cursor + chunkSize >= paragraph.length) {
          break
        }

        cursor += Math.max(1, chunkSize - overlap)
      }

      continue
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph

    if (next.length <= chunkSize) {
      current = next
      continue
    }

    if (current) {
      chunks.push(current)
    }

    current = paragraph
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function countTermOccurrences(text: string, term: string) {
  if (!term) {
    return 0
  }

  let count = 0
  let start = 0

  while (true) {
    const index = text.indexOf(term, start)

    if (index === -1) {
      return count
    }

    count += 1
    start = index + term.length
  }
}

function scoreChunk(
  queryTerms: string[],
  query: string,
  sourceRank: number,
  sourceTitle: string,
  chunk: string,
) {
  const lowerChunk = chunk.toLowerCase()
  const lowerTitle = sourceTitle.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let score = Math.max(0, 8 - sourceRank * 1.5)

  if (lowerChunk.includes(lowerQuery)) {
    score += 8
  }

  for (const term of queryTerms) {
    score += countTermOccurrences(lowerChunk, term) * 2

    if (lowerTitle.includes(term)) {
      score += 2
    }
  }

  return score
}

async function searchDuckDuckGo(query: string, maxResults: number) {
  const endpoints = [
    {
      url: new URL('https://html.duckduckgo.com/html/'),
      parse: (html: string) => {
        const $ = load(html)
        const results: SearchResult[] = []

        $('.result').each((_, element) => {
          if (results.length >= maxResults) {
            return false
          }

          const link = $(element).find('.result__title a, .result__a').first()
          const title = normalizeWhitespace(link.text())
          const href = link.attr('href')
          const snippet = normalizeWhitespace(
            $(element).find('.result__snippet').first().text(),
          )

          if (!title || !href) {
            return
          }

          const urlValue = decodeDuckDuckGoUrl(href)

          if (
            !isAllowedSearchResultUrl(urlValue) ||
            results.some((result) => result.url === urlValue)
          ) {
            return
          }

          results.push({
            title,
            url: urlValue,
            snippet,
          })
        })

        return results
      },
    },
    {
      url: new URL('https://lite.duckduckgo.com/lite/'),
      parse: (html: string) => {
        const $ = load(html)
        const results: SearchResult[] = []

        $('a.result-link').each((_, element) => {
          if (results.length >= maxResults) {
            return false
          }

          const link = $(element)
          const title = normalizeWhitespace(link.text())
          const href = link.attr('href')
          const snippet = normalizeWhitespace(
            link.closest('tr').next('tr').find('.result-snippet').first().text(),
          )

          if (!title || !href) {
            return
          }

          const urlValue = decodeDuckDuckGoUrl(href)

          if (
            !isAllowedSearchResultUrl(urlValue) ||
            results.some((result) => result.url === urlValue)
          ) {
            return
          }

          results.push({
            title,
            url: urlValue,
            snippet,
          })
        })

        return results
      },
    },
  ]

  for (const endpoint of endpoints) {
    endpoint.url.searchParams.set('q', query)

    const response = await fetch(endpoint.url, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      headers: {
        'user-agent': SEARCH_USER_AGENT,
        'accept-language': SEARCH_ACCEPT_LANGUAGE,
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      continue
    }

    const html = await response.text()
    const results = endpoint.parse(html)

    if (results.length) {
      return results
    }
  }

  return []
}

async function extractReadableText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    redirect: 'follow',
    headers: {
      'user-agent': SEARCH_USER_AGENT,
      'accept-language': SEARCH_ACCEPT_LANGUAGE,
      accept: 'text/html,application/xhtml+xml,text/plain',
    },
  })

  if (!response.ok) {
    throw new Error(`Page request failed with ${response.status}.`)
  }

  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()

  if (contentType.includes('text/plain')) {
    return normalizeWhitespace(body)
  }

  const $ = load(body)
  $('script, style, noscript, svg, nav, footer, header, aside, form').remove()

  const preferredRoot =
    $('main').first().length > 0
      ? $('main').first()
      : $('article').first().length > 0
        ? $('article').first()
        : $('body')

  const title = normalizeWhitespace($('title').first().text())
  const text = normalizeWhitespace(preferredRoot.text())
  const metaDescription = normalizeWhitespace(
    $('meta[name="description"]').attr('content') || '',
  )

  return normalizeWhitespace(`${title}\n\n${metaDescription}\n\n${text}`)
}

export async function searchWebWithChunks(input: {
  query: string
  maxResults?: number
  maxChunks?: number
  chunkSize?: number
}) {
  const query = input.query.trim()

  if (!query) {
    throw new Error('Search query is required.')
  }

  const maxResults = Math.min(Math.max(input.maxResults ?? 4, 1), 6)
  const maxChunks = Math.min(Math.max(input.maxChunks ?? 6, 1), 10)
  const chunkSize = Math.min(Math.max(input.chunkSize ?? 1000, 400), 1800)
  const overlap = Math.max(120, Math.floor(chunkSize * 0.15))
  const queryTerms = tokenizeQuery(query)

  const searchResults = await searchDuckDuckGo(query, maxResults)

  if (!searchResults.length) {
    return {
      query,
      generatedAt: new Date().toISOString(),
      sources: [],
      chunks: [],
    }
  }

  const pagePayloads = await Promise.all(
    searchResults.map(async (result, index) => {
      try {
        const text = await extractReadableText(result.url)
        return {
          ...result,
          rank: index + 1,
          text,
          error: null as string | null,
        }
      } catch (error) {
        return {
          ...result,
          rank: index + 1,
          text: normalizeWhitespace(`${result.title}\n\n${result.snippet}`),
          error: error instanceof Error ? error.message : 'Failed to fetch page.',
        }
      }
    }),
  )

  const rankedChunks = pagePayloads.flatMap((page) => {
    const chunks = chunkText(page.text, chunkSize, overlap)

    return chunks.map<SearchChunk>((chunk, index) => ({
      sourceTitle: page.title,
      sourceUrl: page.url,
      chunkIndex: index,
      score: scoreChunk(queryTerms, query, page.rank, page.title, chunk),
      text: chunk,
    }))
  })

  rankedChunks.sort((left, right) => right.score - left.score)

  const selectedChunks: SearchChunk[] = []
  const perSourceLimit = 2
  const sourceCounts = new Map<string, number>()

  for (const chunk of rankedChunks) {
    if (selectedChunks.length >= maxChunks) {
      break
    }

    const count = sourceCounts.get(chunk.sourceUrl) ?? 0

    if (count >= perSourceLimit) {
      continue
    }

    sourceCounts.set(chunk.sourceUrl, count + 1)
    selectedChunks.push(chunk)
  }

  return {
    query,
    generatedAt: new Date().toISOString(),
    sources: pagePayloads.map((page) => ({
      title: page.title,
      url: page.url,
      snippet: page.snippet,
      fetchStatus: page.error ? 'fallback-snippet' : 'fetched',
      note: page.error,
    })),
    chunks: selectedChunks.map((chunk) => ({
      sourceTitle: chunk.sourceTitle,
      sourceUrl: chunk.sourceUrl,
      chunkIndex: chunk.chunkIndex,
      score: Number(chunk.score.toFixed(2)),
      text: chunk.text,
    })),
  }
}
