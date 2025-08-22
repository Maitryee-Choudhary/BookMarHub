import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get bookmarks with filtering
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const tags = searchParams.getAll('tags'); // Get multiple tags
    const isRead = searchParams.get('is_read');

    let query = `
      SELECT * FROM bookmarks 
      WHERE user_id = $1
    `;
    let params = [session.user.id];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      query += ` AND (
        LOWER(title) LIKE LOWER($${paramIndex}) OR 
        LOWER(description) LIKE LOWER($${paramIndex}) OR 
        LOWER(url) LIKE LOWER($${paramIndex}) OR
        LOWER(summary) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add multiple tags filter
    if (tags.length > 0) {
      const tagConditions = tags.map(() => {
        const condition = `(tags && ARRAY[$${paramIndex}] OR auto_tags && ARRAY[$${paramIndex}])`;
        paramIndex++;
        return condition;
      });
      query += ` AND (${tagConditions.join(' AND ')})`;
      params.push(...tags);
    }

    // Add read status filter
    if (isRead !== null) {
      query += ` AND is_read = $${paramIndex}`;
      params.push(isRead === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await sql(query, params);
    return Response.json(result);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return Response.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}

// Create a new bookmark
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, title, description, thumbnail_url, content_type = 'article', tags = [] } = body;

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    // Generate auto-tags and summary using AI
    let autoTags = [];
    let summary = '';
    
    try {
      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title,
          description,
          content_type
        })
      });
      
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        autoTags = aiData.tags || [];
        summary = aiData.summary || '';
      }
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
      // Continue without AI tags/summary
    }

    const result = await sql`
      INSERT INTO bookmarks (
        user_id, url, title, description, thumbnail_url, 
        content_type, tags, auto_tags, summary, is_read
      ) VALUES (
        ${session.user.id}, ${url}, ${title}, ${description}, 
        ${thumbnail_url}, ${content_type}, ${tags}, ${autoTags}, 
        ${summary}, false
      ) RETURNING *
    `;

    return Response.json(result[0]);
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return Response.json({ error: "Failed to create bookmark" }, { status: 500 });
  }
}