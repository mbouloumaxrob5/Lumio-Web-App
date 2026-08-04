'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import UploadDropzoneSigned from '../../components/upload/UploadDropzoneSigned';

export default function UploadPage() {
  const [uploaded, setUploaded] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Uploader une image</h1>
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <UploadDropzoneSigned onUploaded={(img) => setUploaded(img)} />
        </div>

        {uploaded && (
          <div className="mt-6 p-4 border rounded">
            <h2 className="font-semibold">Image téléchargée</h2>
            <p>{uploaded.title}</p>
            <img src={uploaded.url} alt={uploaded.title} className="mt-3 max-w-full rounded" />
          </div>
        )}
      </div>
    </div>
  );
}
