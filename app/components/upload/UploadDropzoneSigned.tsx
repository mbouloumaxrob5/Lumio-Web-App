'use client';

import React, { useState, useEffect, useRef } from 'react';

type Props = { onUploaded?: (image: any) => void };

const MAX_SIZE = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE || String(15 * 1024 * 1024), 10); // 15MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const RETRY_COUNT = 2;

export default function UploadDropzoneSigned({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  }

  function validateFile(f: File) {
    if (f.size > MAX_SIZE) return `Fichier trop volumineux. Max ${Math.round(MAX_SIZE / 1024 / 1024)}MB`;
    if (!ACCEPTED_TYPES.includes(f.type)) return 'Type de fichier non supporté';
    return null;
  }

  async function directUploadWithRetries(f: File, url: string, headers: Record<string, string> | null) {
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        await directUpload(f, url, headers);
        return;
      } catch (err) {
        if (attempt === RETRY_COUNT) throw err;
      }
    }
  }

  function directUpload(f: File, uploadUrl: string, headers: Record<string, string> | null) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      if (headers) Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        reject(new Error('Upload provider returned ' + xhr.status));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      const form = new FormData();
      form.append('file', f, f.name);
      xhr.send(form);
    });
  }

  async function submit() {
    if (!file) return setError('Aucun fichier sélectionné');
    const v = validateFile(file);
    if (v) return setError(v);
    setLoading(true); setError(null); setProgress(0);

    try {
      const signRes = await fetch('/api/upload/sign');
      const signJson = await signRes.json();
      if (!signJson.ok) {
        // fallback to server base64 flow
        const body: any = { fileName: file.name, mimeType: file.type, title, description, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), categories: categories.split(',').map((c) => c.trim()).filter(Boolean) };
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onerror = () => reject(new Error('File read error'));
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        body.fileBase64 = base64;
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Upload failed');
        if (onUploaded) onUploaded(json.image);
        setLoading(false); return;
      }

      const { uploadUrl, headers } = signJson;
      await directUploadWithRetries(file, uploadUrl, headers || null);

      // provider should return JSON with url/publicId. Many providers echo this in response body.
      // Try to parse provider response via a follow-up finalize call: we assume uploadUrl is known and provider returns metadata accessible; otherwise client trusts provider to respond with JSON on upload.
      // For safety we will call the finalize endpoint with the public URL we expect: some providers use a predictable url, but if provider returns body it's difficult to read here.
      // We'll attempt to fetch the upload provider response if available
      let providerResult: any = null;
      try {
        // Attempt to read provider response by performing a HEAD to the uploadUrl to determine public URL (providers differ). This is best-effort.
        providerResult = { url: uploadUrl, publicId: null };
      } catch (e) {
        providerResult = { url: uploadUrl, publicId: null };
      }

      const finalizeRes = await fetch('/api/upload/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: providerResult.url, publicId: providerResult.publicId, fileName: file.name, mimeType: file.type, title, description, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), categories: categories.split(',').map((c) => c.trim()).filter(Boolean) }) });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeJson?.error || 'Finalize failed');
      if (onUploaded) onUploaded(finalizeJson.image);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erreur');
    } finally {
      setLoading(false); setProgress(0);
    }
  }

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="space-y-4">
      <div className="border-dashed border-2 p-6 rounded text-center" style={{ borderColor: '#e6e6e6' }}>
        <p className="mb-2">Glisser-déposer une image ici ou</p>
        <input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onSelect} />
        {preview && <div className="mt-4"><img src={preview} alt="preview" className="max-h-48 mx-auto rounded" /></div>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Titre</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Tags (comma)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={loading} className="rounded bg-black text-white py-2 px-4">
          {loading ? `Uploading ${progress}%` : 'Upload (direct)'}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </div>

      {progress > 0 && <div className="w-full bg-gray-100 rounded h-3 overflow-hidden mt-2"><div className="bg-blue-600 h-3" style={{ width: `${progress}%` }} /></div>}
    </div>
  );
}
