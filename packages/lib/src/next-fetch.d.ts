// These fetchers run inside the Next.js web app, which augments RequestInit
// with a `next` caching field. This package is compiled standalone (plain tsc)
// without Next's types, so declare the field here for isolated type-checking.
// Scoped to this package's program only — it is not imported by the web app,
// so it cannot conflict with Next's own RequestInit augmentation.
declare global {
  interface RequestInit {
    next?: {
      revalidate?: number | false;
      tags?: string[];
    };
  }
}

export {};
