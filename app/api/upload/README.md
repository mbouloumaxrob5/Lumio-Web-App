### Uploadthing integration

This endpoint `/api/upload` accepts a JSON POST containing a base64-encoded image and metadata and will:
- write the temporary file on the server,
- optionally upload to Uploadthing if `UPLOADTHING_ENDPOINT` and `UPLOADTHING_API_KEY` are set,
- extract blurDataUrl and palette,
- call the embeddings provider (`EMBEDDINGS_URL`) to obtain an embedding,
- create the image record in the database and link tags/categories.

Request body (JSON):
{
  "fileName": "example.jpg",
  "mimeType": "image/jpeg",
  "fileBase64": "...",
  "title": "My Image",
  "description": "...",
  "tags": ["tag1","tag2"],
  "categories": ["Nature"]
}

Response:
{ ok: true, image: { /* prisma image object */ } }
