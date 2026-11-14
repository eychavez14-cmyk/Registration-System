// Banners can be images, GIFs or videos; videos are told apart by file extension.
export const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url);
