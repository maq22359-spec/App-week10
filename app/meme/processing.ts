export type Landmark = { x: number; y: number; z?: number };
export type FeatureWindow = { x: number; y: number; rx: number; ry: number };
export type MemeAdjustments = { ink: number; scale: number; x: number; y: number };
export const DEFAULT_ADJUSTMENTS: MemeAdjustments = { ink: .95, scale: 1, x: 0, y: 0 };
// These anchors are shared by the live template holes and the final composite.
export const MEME_TARGETS = [
  { x: .568, y: .205, rx: .085, ry: .057, label: "左眼 / Left eye" },
  { x: .858, y: .278, rx: .085, ry: .057, label: "右眼 / Right eye" },
  { x: .712, y: .395, rx: .061, ry: .106, label: "鼻子 / Nose" },
  { x: .666, y: .545, rx: .09, ry: .061, label: "嘴 / Mouth" },
] as const;

export function featureAnchors(points: Landmark[]): Landmark[] {
  if (points.length < 468) throw new Error("请正对相机重拍。 / Please face the camera and retry.");
  const midpoint = (a: number, b: number) => ({ x: (points[a].x + points[b].x) / 2, y: (points[a].y + points[b].y) / 2 });
  return [midpoint(33, 133), midpoint(263, 362), points[1], midpoint(13, 14)];
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** Separate, feathered masks include features without bringing the face outline. */
export function featureWindows(points: Landmark[]): FeatureWindow[] {
  if (points.length < 468) throw new Error("没有识别到完整五官，请正对相机重拍。 / Please face the camera and try again.");
  const groups = [
    [33, 133, 159, 145, 70, 63, 105, 66, 107, 55, 46],
    [263, 362, 386, 374, 336, 296, 334, 293, 300, 285, 276],
    [197, 195, 5, 4, 1, 19, 94, 2, 98, 327],
    [61, 291, 0, 17, 13, 14, 37, 267, 84, 314],
  ];
  return groups.map((indices, index) => {
    const selected = indices.map(i => points[i]);
    const left = Math.min(...selected.map(p => p.x));
    const right = Math.max(...selected.map(p => p.x));
    const top = Math.min(...selected.map(p => p.y));
    const bottom = Math.max(...selected.map(p => p.y));
    const width = Math.max(right - left, .025);
    const height = Math.max(bottom - top, .025);
    return {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      rx: width * (index < 2 ? .64 : .62),
      ry: Math.max(height * .68, width * (index < 2 ? .32 : .3)),
    };
  });
}

export function featureOwner(x: number, y: number, windows: FeatureWindow[]): number {
  let owner = -1;
  let nearest = 1;
  windows.forEach((region, index) => {
    const distance = ((x - region.x) / region.rx) ** 2 + ((y - region.y) / region.ry) ** 2;
    if (distance < nearest) { owner = index; nearest = distance; }
  });
  return owner;
}

export function featureOpacity(x: number, y: number, windows: FeatureWindow[]): number {
  let opacity = 0;
  for (const region of windows) {
    const distance = ((x - region.x) / region.rx) ** 2 + ((y - region.y) / region.ry) ** 2;
    const feather = clamp((1 - distance) / .35);
    opacity = Math.max(opacity, feather * feather * (3 - 2 * feather));
  }
  return opacity;
}

/** Light skin becomes white; dark facial details become a small set of ink tones. */
export function inkTone(luminance: number, black: number, white: number, strength: number): number {
  const darkness = clamp((white - luminance) / Math.max(white - black, 24));
  const ink = clamp(Math.pow(darkness, 1.25) * strength);
  return Math.round((255 - ink * 255) / 5) * 5;
}

export function makeFeatureLayer(image: ImageData, points: Landmark[], strength: number): { image: ImageData; bounds: { x: number; y: number; width: number; height: number } } {
  const windows = featureWindows(points);
  const histogram = new Uint32Array(256);
  let samples = 0;
  const { width, height, data } = image;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (featureOpacity(x / width, y / height, windows) < .5) continue;
      const i = (y * width + x) * 4;
      histogram[Math.round(data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722)]++;
      samples++;
    }
  }
  if (!samples) throw new Error("脸离镜头太远，请靠近虚线框。 / Move your face closer to the guide.");
  const percentile = (fraction: number) => {
    let total = 0;
    for (let value = 0; value < 256; value++) {
      total += histogram[value];
      if (total >= samples * fraction) return value;
    }
    return 255;
  };
  const black = percentile(.06);
  const white = percentile(.8);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;
      // Fade crop edges so a clipped hairline or source-image border cannot
      // become a hard rectangular mark next to a facial feature.
      const edge = clamp((nx - .025) / .025) * clamp((.975 - nx) / .025) * clamp((ny - .025) / .025) * clamp((.975 - ny) / .025);
      const alpha = featureOpacity(nx, ny, windows) * edge;
      const value = inkTone(data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722, black, white, strength);
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const left = clamp(Math.min(...windows.map(r => r.x - r.rx)));
  const top = clamp(Math.min(...windows.map(r => r.y - r.ry)));
  const right = clamp(Math.max(...windows.map(r => r.x + r.rx)));
  const bottom = clamp(Math.max(...windows.map(r => r.y + r.ry)));
  return { image, bounds: { x: left * width, y: top * height, width: (right - left) * width, height: (bottom - top) * height } };
}

export function composeMeme(template: HTMLImageElement, source: HTMLCanvasElement, points: Landmark[], adjust: MemeAdjustments): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = template.naturalWidth;
  output.height = template.naturalHeight;
  const ctx = output.getContext("2d");
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx || !sourceCtx) throw new Error("无法生成图片，请重试。 / Could not create the image. Please retry.");
  const layer = makeFeatureLayer(sourceCtx.getImageData(0, 0, source.width, source.height), points, adjust.ink);
  const patch = document.createElement("canvas");
  patch.width = source.width;
  patch.height = source.height;
  patch.getContext("2d")!.putImageData(layer.image, 0, 0);
  ctx.drawImage(template, 0, 0);
  ctx.save();
  // Keep all facial features inside the template's blank head, even after edits.
  ctx.beginPath();
  ctx.ellipse(output.width * .705, output.height * .35, output.width * .285, output.height * .285, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = "multiply";
  const windows = featureWindows(points);
  const anchors = featureAnchors(points);
  const owners = new Int8Array(source.width * source.height);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) owners[y * source.width + x] = featureOwner(x / source.width, y / source.height, windows);
  }
  // Sort the eye landmarks by their image position, independent of selfie
  // mirroring. Map each eye/nose/mouth to its own matching template opening.
  const eyes = [0, 1].sort((a, b) => anchors[a].x - anchors[b].x);
  [eyes[0], eyes[1], 2, 3].forEach((sourceIndex, targetIndex) => {
    // A pixel belongs to exactly one feature. Overlapping source rectangles
    // must never copy an eye a second time into the nose or mouth opening.
    const isolated = sourceCtx.getImageData(0, 0, source.width, source.height);
    isolated.data.set(layer.image.data);
    for (let i = 0; i < owners.length; i++) if (owners[i] !== sourceIndex) isolated.data[i * 4 + 3] = 0;
    patch.getContext("2d")!.putImageData(isolated, 0, 0);
    const region = windows[sourceIndex];
    const anchor = anchors[sourceIndex];
    const target = MEME_TARGETS[targetIndex];
    const left = Math.max(0, (region.x - region.rx) * source.width);
    const top = Math.max(0, (region.y - region.ry) * source.height);
    const right = Math.min(source.width, (region.x + region.rx) * source.width);
    const bottom = Math.min(source.height, (region.y + region.ry) * source.height);
    const scale = Math.min(target.rx * 2 * output.width / (right - left), target.ry * 2 * output.height / (bottom - top)) * adjust.scale;
    const x = target.x * output.width + adjust.x - (anchor.x * source.width - left) * scale;
    const y = target.y * output.height + adjust.y - (anchor.y * source.height - top) * scale;
    ctx.drawImage(patch, left, top, right - left, bottom - top, x, y, (right - left) * scale, (bottom - top) * scale);
  });
  ctx.restore();
  return output;
}
