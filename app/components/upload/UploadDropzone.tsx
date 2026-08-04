'use client';

import React, { useState, useCallback } from 'react';

type Props = {
  onUploaded?: (image: any) => void;
};

export default function UploadDropzone({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = useCallback((f: File | null) => {
    setFile(f);
  }, []);

  async function submit() {
    if (!file) return setError('Aucun fichier sélectionné');
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(new Error('File read error'));
        reader.onload = () => {
          const result = reader.result as string;
          // strip data:*/*;base64,
          const idx = result.indexOf(',');
          resolve(result.slice(idx + 1));
        };
        reader.readAsDataURL(file);
      });

      const payload = {
        fileName: file.name,
        mimeType: file.type,
        fileBase64: base64,
        title: title || file.name,
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        categories: categories.split(',').map((c) => c.trim()).filter(Boolean)
      };

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Upload failed');
      } else {
        setFile(null);
        setTitle('');
        setDescription('');
        setTags('');
        setCategories('');
        if (onUploaded) onUploaded(json.image);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded space-y-4">
      <div>
        <label className="block text-sm font-medium">Fichier</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files ? e.target.files[0] : null)}
          className="mt-2"
        />
        {file && <p className="text-sm mt-2">Sélectionné : {file.name} ({Math.round(file.size / 1024)} KB)</p>}
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
        <button onClick={submit} disabled={loading} className="w-full rounded bg-black text-white py-2">
          {loading ? 'Upload...' : 'Upload'}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
