export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0)',
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Failed to fetch URL" }, { status: 400 });
    }

    const html = await response.text();

    // Extract metadata using regex (basic Open Graph and meta tags)
    const metadata = {
      title: extractMetaContent(html, 'og:title') || 
             extractMetaContent(html, 'twitter:title') || 
             extractTitle(html) || 
             url,
      description: extractMetaContent(html, 'og:description') || 
                  extractMetaContent(html, 'twitter:description') || 
                  extractMetaContent(html, 'description'),
      image: extractMetaContent(html, 'og:image') || 
             extractMetaContent(html, 'twitter:image'),
      type: extractMetaContent(html, 'og:type') || 'article',
      url: url
    };

    // Try to determine content type from URL patterns
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata.type = 'video';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      metadata.type = 'tweet';
    } else if (url.includes('linkedin.com')) {
      metadata.type = 'post';
    }

    return Response.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return Response.json({ error: "Failed to extract metadata" }, { status: 500 });
  }
}

function extractMetaContent(html, property) {
  // Try Open Graph meta tags
  let regex = new RegExp(`<meta\\s+property\\s*=\\s*["']${property}["']\\s+content\\s*=\\s*["']([^"']+)["']`, 'i');
  let match = html.match(regex);
  
  if (match) return match[1];
  
  // Try Twitter meta tags or standard meta tags
  regex = new RegExp(`<meta\\s+name\\s*=\\s*["']${property}["']\\s+content\\s*=\\s*["']([^"']+)["']`, 'i');
  match = html.match(regex);
  
  if (match) return match[1];
  
  // Try reverse order (content before name/property)
  regex = new RegExp(`<meta\\s+content\\s*=\\s*["']([^"']+)["']\\s+(?:name|property)\\s*=\\s*["']${property}["']`, 'i');
  match = html.match(regex);
  
  return match ? match[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}