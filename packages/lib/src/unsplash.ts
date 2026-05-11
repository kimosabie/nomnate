const BASE = "https://api.unsplash.com";

export interface UnsplashPhoto {
  imageUrl: string;
  imageAttribution: string;
}

export async function searchUnsplashPhoto(
  query: string,
  accessKey: string
): Promise<UnsplashPhoto | null> {
  try {
    const url = `${BASE}/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape&client_id=${accessKey}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json() as { results: { urls: { regular: string }; user: { name: string } }[] };
    const photo = data.results?.[0];
    if (!photo) return null;
    return {
      imageUrl: photo.urls.regular,
      imageAttribution: `Photo by ${photo.user.name} on Unsplash`,
    };
  } catch {
    return null;
  }
}
