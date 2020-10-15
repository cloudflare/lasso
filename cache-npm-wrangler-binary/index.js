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
      if (res.status != 200) {
        console.error("Non-200 response from GitHub", url, res.status, await res.json())
        throw new Error("Non-200 response from GitHub")
      } else {
        return res.json();
      }
    })
    .catch((err) => {
      console.error("Error fetching from GitHub", url, err);
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

  if (release.assets_url === undefined) {
    console.error("Release does not contain an assets_url property", release)
    throw new Error("Release does not contain an assets_url property")
  }

  // Do we even need to do this? It appears that `release` already contains an `assets` array.
  let assets = await getJSONFromGitHub(release.assets_url);

  const [compatibleAsset] = assets.filter((asset) =>
    asset.name.endsWith(arch + ".tar.gz")
  );

  const assetURL = compatibleAsset.browser_download_url;

  const { value: cachedAsset, metadata: init } = await LASSO_KV.getWithMetadata(
    assetURL,
    "stream"
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
