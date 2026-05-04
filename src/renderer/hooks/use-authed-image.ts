import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api";

// Loads an /api/* image as a blob via authedFetch (so the X-Trident-Auth
// header is attached) and returns an object URL suitable for <img src>.
// Browsers don't let `<img>` carry custom headers, so we can't reach the
// authed server route directly — fetch + URL.createObjectURL is the
// standard workaround. Returns null while loading or on error.
export function useAuthedImage(url: string | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    authedFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to load authed image:", url, err);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  return objectUrl;
}
