import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Update a bookmark
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { title, description, tags, is_read, summary } = body;

    // Build dynamic update query
    let setClause = [];
    let values = [session.user.id, id];
    let paramIndex = 3;

    if (title !== undefined) {
      setClause.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      setClause.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (tags !== undefined) {
      setClause.push(`tags = $${paramIndex}`);
      values.push(tags);
      paramIndex++;
    }

    if (is_read !== undefined) {
      setClause.push(`is_read = $${paramIndex}`);
      values.push(is_read);
      paramIndex++;
    }

    if (summary !== undefined) {
      setClause.push(`summary = $${paramIndex}`);
      values.push(summary);
      paramIndex++;
    }

    setClause.push(`updated_at = NOW()`);

    if (setClause.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const query = `
      UPDATE bookmarks 
      SET ${setClause.join(', ')} 
      WHERE user_id = $1 AND id = $2 
      RETURNING *
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Bookmark not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error('Error updating bookmark:', error);
    return Response.json({ error: "Failed to update bookmark" }, { status: 500 });
  }
}

// Delete a bookmark
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const result = await sql`
      DELETE FROM bookmarks 
      WHERE user_id = ${session.user.id} AND id = ${id} 
      RETURNING id
    `;

    if (result.length === 0) {
      return Response.json({ error: "Bookmark not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return Response.json({ error: "Failed to delete bookmark" }, { status: 500 });
  }
}

// Get a single bookmark
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const result = await sql`
      SELECT * FROM bookmarks 
      WHERE user_id = ${session.user.id} AND id = ${id}
    `;

    if (result.length === 0) {
      return Response.json({ error: "Bookmark not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error('Error fetching bookmark:', error);
    return Response.json({ error: "Failed to fetch bookmark" }, { status: 500 });
  }
}