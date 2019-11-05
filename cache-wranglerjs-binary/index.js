/**
 * This Worker is responsible for caching wranglerjs binaries.
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  let urlParts = /^https?:\/\/workers\.cloudflare\.com\/get\-wranglerjs\-binary\/([^\/]+)\/([^\/]+)\.tar\.gz/.exec(request.url)
  if (!urlParts) {
    return new Response("Missing URL components", {status: 400})
  }

  let toolName, version
  [_, toolName, version] = urlParts

  console.log(urlParts)

  if (version[0] == 'v') {
    version = version.substring(1)
  }

  return fetch(`https://github.com/cloudflare/wrangler/releases/download/v${version}/${toolName}-v${version}.tar.gz`, {
    cf: {
      cacheEverything: true,
      cacheTtl: 3600
    }
  })
}