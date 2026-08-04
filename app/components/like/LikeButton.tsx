'use client';

import React, { useState } from 'react';

export default function LikeButton({ imageId, initialLiked = false, initialCount = 0 }: { imageId: string; initialLiked?: boolean; initialCount?: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    // optimistic
    setLiked(!liked);
    setCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageId }) });
      const json = await res.json();
      if (!res.ok) {
        // rollback
        setLiked((s) => !s);
        setCount((c) => c + (liked ? 1 : -1));
        console.error(json?.error || 'Like failed');
      }
    } catch (err) {
      setLiked((s) => !s);
      setCount((c) => c + (liked ? 1 : -1));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={toggle} disabled={loading} className={`inline-flex items-center gap-2 ${liked ? 'text-red-600' : 'text-gray-700'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-8.682a4.5 4.5 0 010-6.364z"/></svg>
      <span>{count}</span>
    </button>
  );
}
