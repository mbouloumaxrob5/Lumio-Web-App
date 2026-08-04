'use client';

import React, { useState } from 'react';

type Props = { onUploaded?: (image: any) => void };

export default function UploadDropzoneSigned({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!file) return setError('No file');
    setLoading(true); setError(null);

    try {
      // request upload endpoint info
      const signRes = await fetch('/api/upload/sign');
      const signJson = await signRes.json();
      if (!signJson.ok) {
        // fallback to server base64 flow
        const body = { fileName: file.name, mimeType: file.type, title, description, tags: tags.split(',').map(t=>t.trim()).filter(Boolean), categories: categories.split(',').map(c=>c.trim()).filter(Boolean) };
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onerror = () => reject(new Error('File read error'));
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        (body as any).fileBase64 = base64;
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Upload failed');
        if (onUploaded) onUploaded(json.image);
        setLoading(false); return;
      }

      const { uploadUrl, headers } = signJson;

      // perform direct upload via XHR to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        // set headers
        if (headers) {
          Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, String(v)));
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = async () => {
          try {
            const json = JSON.parse(xhr.responseText);
            // Expect upload provider to return { url, publicId }
            const url = json.url;
            const publicId = json.publicId || null;
            // finalize on server
            const finalizeRes = await fetch('/api/upload/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, publicId, fileName: file.name, mimeType: file.type, title, description, tags: tags.split(',').map(t=>t.trim()).filter(Boolean), categories: categories.split(',').map(c=>c.trim()).filter(Boolean) }) });
            const finalizeJson = await finalizeRes.json();
            if (!finalizeRes.ok) return reject(new Error(finalizeJson?.error || 'Finalize failed'));
            if (onUploaded) onUploaded(finalizeJson.image);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        const form = new FormData();
        form.append('file', file, file.name);
        xhr.send(form);
      });

      setLoading(false);
      setProgress(0);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Upload error');
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded space-y-4">
      <div>
        <label className="block text-sm font-medium">Fichier</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="mt-2" />
        {file && <p className="text-sm mt-2">Sélectionné : {file.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium">Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Categories (comma separated)</label>
          <input value={categories} onChange={(e) => setCategories(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
      </div>

      <div>
        <button onClick={onSubmit} disabled={loading} className="w-full rounded bg-black text-white py-2">
          {loading ? `Uploading... ${progress}%` : 'Upload (direct)'}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
