/**
 * This Worker is responsible for caching dependency binaries for Wrangler.
 */

 addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  let urlParts = /^https?:\/\/workers\.cloudflare\.com\/get\-binary\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\.tar\.gz/.exec(request.url)
  if (!urlParts) {
    return new Response("Missing URL components", { status: 400 })
  }

  let owner, toolName, version, target
  [_, owner, toolName, version, target] = urlParts

  if (version[0] == 'v') {
    version = version.substring(1)
  }

  const opts = {
    cf: {
      cacheEverything: true,
      cacheTtl: 3600
    }
  }

  // temporary fix until M1 / Apple Silicon builds are more widely available from source repos
  if (target === 'aarch64-apple-darwin') {
    // hard-code wrangler release, and update manually until we have automation for M1 (current: v1.14.1)
    // return fetch(`https://github.com/cloudflare/wrangler/releases/download/v${version}/${toolName}-v${version}-${target}.tar.gz`, opts)
    return fetch(`https://github.com/cloudflare/wrangler/releases/download/v1.14.1/${toolName}-v${version}-${target}.tar.gz`, opts)
  }

  let ownersToToolNames = new Map()
  ownersToToolNames.set("ashleygwilliams", ["cargo-generate"])
  ownersToToolNames.set("rustwasm", ["wasm-pack"])
  ownersToToolNames.set("cloudflare", ["cloudflared"])

  if (!ownersToToolNames.get(owner).includes(toolName)) {
    return new Response("Unauthorized tool", { status: 400 })
  }

  return fetch(`https://github.com/${owner}/${toolName}/releases/download/v${version}/${toolName}-v${version}-${target}.tar.gz`, opts)
}