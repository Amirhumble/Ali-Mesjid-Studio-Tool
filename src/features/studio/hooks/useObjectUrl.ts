import { useEffect, useState } from "react";

export function useObjectUrl(source: Blob | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setObjectUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(source);
    setObjectUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [source]);

  return objectUrl;
}
