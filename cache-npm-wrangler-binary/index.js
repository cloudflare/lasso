/**
 * This Worker is responsible for caching Wrangler binaries for installation by the npm installer.
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function getJSONFromGitHub(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Workers'
    }
  })
    .then(async res => {
      return res.json()
    })
    .catch(err => {
      console.error("Error loading", url, err)
      throw err
    })
}

async function getReleaseByTag(tag) {
  return getJSONFromGitHub(`https://api.github.com/repos/cloudflare/wrangler/releases/tags/v${tag}`)
}

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  let urlParts = /^https?:\/\/workers\.cloudflare\.com\/get\-npm\-wrangler\-binary\/([^\/]+)\/([^\/]+)(?:\/|$)/.exec(request.url)
  if (!urlParts)
    return new Response("Missing URL components", {status: 400})

  let tag, arch
  [_, tag, arch] = urlParts

  if (tag[0] == 'v')
    tag = tag.substring(1)

  let release = await getReleaseByTag(tag)

  let assets = await getJSONFromGitHub(release.assets_url)

  const [compatibleAsset] = assets.filter(asset =>
    asset.name.endsWith(arch + ".tar.gz")
  );

  return fetch(compatibleAsset.browser_download_url, {
    cf: {
      cacheEverything: true,
      cacheTtl: 3600
    }
  })
}