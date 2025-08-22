export async function POST(request) {
  try {
    const body = await request.json();
    const { url, title, description, content_type } = body;

    // Prepare content for analysis
    let contentText = `URL: ${url}`;
    if (title) contentText += `\nTitle: ${title}`;
    if (description) contentText += `\nDescription: ${description}`;
    if (content_type) contentText += `\nContent Type: ${content_type}`;

    // Call Google Gemini to analyze content and generate tags/summary
    const response = await fetch('/integrations/google-gemini-2-5-pro/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{
          role: 'system',
          content: `You are an intelligent content analyzer. Analyze the provided content and generate relevant tags and a brief summary.

Rules:
- Generate 3-5 relevant tags that categorize the content
- Tags should be single words or short phrases (max 2 words)
- Create a 1-2 sentence summary that captures the main idea
- For images, focus on visual content and context
- For articles/videos, focus on topic and key themes
- For tweets/social media, focus on the main message or topic

Respond with structured data.`
        }, {
          role: 'user',
          content: `Please analyze this content and provide tags and summary:\n\n${contentText}`
        }],
        json_schema: {
          name: "content_analysis",
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              summary: {
                type: "string"
              }
            },
            required: ["tags", "summary"],
            additionalProperties: false
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze content with AI');
    }

    const aiResult = await response.json();
    const analysis = JSON.parse(aiResult.choices[0].message.content);

    return Response.json({
      tags: analysis.tags || [],
      summary: analysis.summary || ''
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    return Response.json({ 
      tags: [], 
      summary: '' 
    }); // Return empty arrays/strings instead of error to not break bookmark creation
  }
}