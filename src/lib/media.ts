// Banners can be images, GIFs or videos; videos are told apart by file extension.
export const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url);

// Animated GIFs (resizing would freeze them) and SVGs are served as uploaded; other images go through Vercel's resizer.
export const skipOptimize = (url: string) => /\.(gif|svg)(\?|#|$)/i.test(url);
