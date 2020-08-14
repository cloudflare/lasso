/**
 * This Worker is responsible for caching Wrangler binaries for installation by the npm installer.
 */

addEventListener("fetch", (event) => {
  event.respondWith(handleEvent(event));
});

async function getJSONFromGitHub(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "Workers",
    },
  })
    .then(async (res) => {
      return res.json();
    })
    .catch((err) => {
      console.error("Error loading", url, err);
      throw err;
    });
}

async function getReleaseByTag(tag) {
  return getJSONFromGitHub(
    `https://api.github.com/repos/cloudflare/wrangler/releases/tags/v${tag}`
  );
}

async function cacheAsset(key, response) {
  const { status, statusText, body } = response;
  const headers = {};
  for (const [header, value] of response.headers) {
    headers[header] = value;
  }

  return await LASSO_KV.put(key, body, {
    metadata: { status, statusText, headers },
  });
}

async function handleEvent(event) {
  let urlParts = /^https?:\/\/workers\.cloudflare\.com\/get\-npm\-wrangler\-binary\/([^\/]+)\/([^\/]+)(?:\/|$)/.exec(
    event.request.url
  );
  if (!urlParts) return new Response("Missing URL components", { status: 400 });

  let tag, arch;
  [_, tag, arch] = urlParts;

  if (tag[0] == "v") tag = tag.substring(1);

  let release = await getReleaseByTag(tag);

  let assets = await getJSONFromGitHub(release.assets_url);

  const [compatibleAsset] = assets.filter((asset) =>
    asset.name.endsWith(arch + ".tar.gz")
  );

  const assetURL = compatibleAsset.browser_download_url;

  const { value: cachedAsset, metadata: init } = await LASSO_KV.getWithMetadata(
    assetURL,
    "steam"
  );

  if (!!cachedAsset) {
    return new Response(cachedAsset, init);
  }

  const response = await fetch(assetURL, {
    cf: {
      cacheEverything: true,
      cacheTtl: 3600,
    },
  });

  if (response.ok) {
    event.waitUntil(cacheAsset(assetURL, response.clone()));
  }

  return response;
}
