
const LOG_URL = "http://logs-01.loggly.com/inputs/c4be8134-d001-41a6-9c35-2118a7502d6e/tag/http/"

function postLog(data) {
  return fetch(LOG_URL, {
    method: "POST",
    body: JSON.stringify({ message: data }),
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  })
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event))
})
/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(event) {
  const request = event.request
  // Test for GET only
  if (request.method !== "GET") {

    console.log('Not a GET request')
    return new Response('Invalid Method', { status: 400 })
  }
  // Parse request URL to get access to query string
  let url = new URL(request.url)

  // Need to add image type to key for cache
  const accept = request.headers.get("Accept");
  let imageKey = ""
  if (/image\/avif/.test(accept)) {
    imageKey = 'avif';
  } else if (/image\/webp/.test(accept)) {
    imageKey = 'webp';
  }

  // Construct the cache key from the cache URL
  const cacheKey = new Request(url.toString() + imageKey, request)
  const cache = caches.default
  let response = await cache.match(cacheKey)
  if (!response) {


    // Cloudflare-specific options are in the cf object.
    let options = { cf: { image: {} } }

    // Copy parameters from query string to request options.
    // You can implement various different parameters here.
    if (url.searchParams.has("fit")) options.cf.image.fit = url.searchParams.get("fit")
    if (url.searchParams.has("width")) options.cf.image.width = url.searchParams.get("width")
    if (url.searchParams.has("height")) options.cf.image.height = url.searchParams.get("height")
    if (url.searchParams.has("quality")) options.cf.image.quality = url.searchParams.get("quality")

    // Your Worker is responsible for automatic format negotiation. Check the Accept header.

    if (/image\/avif/.test(accept)) {
      options.cf.image.format = 'avif';
    } else if (/image\/webp/.test(accept)) {
      options.cf.image.format = 'webp';
    }

    // Get URL of the original (full size) image to resize.
    // You could adjust the URL here, e.g., prefix it with a fixed address of your server,
    // so that user-visible URLs are shorter and cleaner.
    const imageURL = url.searchParams.get("image")
    if (!imageURL) return new Response('Missing "image" value', { status: 400 })

    try {
      // TODO: Customize validation logic
      const { hostname, pathname } = new URL(imageURL)

      // Optionally, only allow URLs with JPEG, PNG, GIF, or WebP file extensions
      // @see https://developers.cloudflare.com/images/url-format#supported-formats-and-limitations
      if (!/\.(jpe?g|png|gif|webp)$/i.test(pathname)) {
        return new Response('Disallowed file extension', { status: 400 })
      }


    } catch (err) {
      return new Response('Invalid "image" value', { status: 400 })
    }

    // Build a request that passes through request headers to get original image
    const imageRequest = new Request(imageURL, {
      headers: request.headers
    })
    console.log(`NOT IN CACHE FOR ${cacheKey}`)
    event.waitUntil(postLog(`${url.toString()} not in cache`))
    // Returning fetch() with resizing options will pass through response with the resized image.
    response = await fetch(imageRequest, options)
    // Must use Response constructor to inherit all of response's fields
    response = new Response(response.body, response)
    //loop over the headers into a string so I can conole log it
    let headers = ""
    response.headers.forEach((value, key) => {
      headers += `${key}: ${value}\n`
    })

    console.log(headers)
    // Cache API respects Cache-Control headers. Setting s-max-age to 10
    // will limit the response to be in cache for 10 seconds max

    // Any changes made to the response here will be reflected in the cached value
    response.headers.append("Cache-Control", "max-age=2592000")

    // Store the fetched response as cacheKey
    // Use waitUntil so you can return the response without blocking on
    // writing to cache
    console.log(`Writing to Cache for ${cacheKey}`)
    event.waitUntil(cache.put(cacheKey, response.clone()))
  } else {
    console.log(`FOUND IN CACHE FOR ${cacheKey}`)
    event.waitUntil(postLog(`${url.toString()} FOUND in cache`))
    let headers = ""
    response.headers.forEach((value, key) => {
      headers += `${key}: ${value}\n`
    })

    console.log(headers)
  }
  // cached response
  return response;
}