export const PHOTO_COUNT = 4;
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 810;
export const STRIP_BORDER = 60;
export const STRIP_GAP = 24;
export const STRIP_FOOTER = 162;

/** Center-crop a camera frame to the same 4:3 composition shown in the guide. */
export function cropFrame(sourceWidth: number, sourceHeight: number) {
  const ratio = PHOTO_WIDTH / PHOTO_HEIGHT;
  const width = Math.min(sourceWidth, sourceHeight * ratio);
  const height = width / ratio;
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height };
}

export function previewCrop(sourceWidth: number, sourceHeight: number, preview: Pick<DOMRect, "left" | "top" | "width" | "height">, guide: Pick<DOMRect, "left" | "top" | "width" | "height">) {
  const scale = Math.max(preview.width / sourceWidth, preview.height / sourceHeight);
  const overflowX = (sourceWidth * scale - preview.width) / 2;
  const overflowY = (sourceHeight * scale - preview.height) / 2;
  const width = guide.width / scale;
  const height = guide.height / scale;
  return {
    x: sourceWidth - (guide.left - preview.left + overflowX) / scale - width,
    y: (guide.top - preview.top + overflowY) / scale,
    width,
    height,
  };
}

export function takePhoto(video: HTMLVideoElement, monochrome: boolean, guide?: DOMRect): string {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    throw new Error("The camera paused. Please try again.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the photo.");
  const crop = guide ? previewCrop(video.videoWidth, video.videoHeight, video.getBoundingClientRect(), guide) : cropFrame(video.videoWidth, video.videoHeight);
  ctx.translate(PHOTO_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  // Pixel conversion also works on Safari versions without canvas filter support.
  if (monochrome) {
    const image = ctx.getImageData(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    for (let i = 0; i < image.data.length; i += 4) {
      const gray = Math.round(image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = gray;
    }
    ctx.putImageData(image, 0, 0);
  }
  return canvas.toDataURL("image/jpeg", 0.94);
}

export async function makeStrip(photos: string[], date: Date): Promise<Blob> {
  if (photos.length !== PHOTO_COUNT) throw new Error("We need all four photos to make your strip. Please retake.");
  const images = await Promise.all(photos.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A photo could not be loaded. Please retake."));
    image.src = src;
  })));
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_WIDTH + STRIP_BORDER * 2;
  canvas.height = STRIP_BORDER + PHOTO_HEIGHT * PHOTO_COUNT + STRIP_GAP * (PHOTO_COUNT - 1) + STRIP_FOOTER;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the photo strip.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((image, i) => ctx.drawImage(image, STRIP_BORDER, STRIP_BORDER + i * (PHOTO_HEIGHT + STRIP_GAP), PHOTO_WIDTH, PHOTO_HEIGHT));
  const footerY = STRIP_BORDER + PHOTO_HEIGHT * PHOTO_COUNT + STRIP_GAP * (PHOTO_COUNT - 1);
  ctx.fillStyle = "#292c28";
  ctx.textAlign = "center";
  ctx.font = "italic 48px Georgia, serif";
  ctx.fillText("little moments", canvas.width / 2, footerY + 69);
  ctx.fillStyle = "#7a7c75";
  ctx.font = "19px -apple-system, sans-serif";
  ctx.fillText(date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase(), canvas.width / 2, footerY + 115);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Your photo strip could not be saved. Please try again.")), "image/png"));
}
