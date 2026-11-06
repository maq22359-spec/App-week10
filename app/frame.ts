export const PHOTO_FRAMES = [
  { id: "none", label: "No frame", hint: "Just you and your little moment", src: null },
  { id: "dungeon", label: "Dungeon feast", hint: "迷宫饭 · A feast worth remembering", src: "/frames/dungeon-feast.png" },
  { id: "meme", label: "These two", hint: "这两个人 · Original artwork from your photo", src: "/frames/these-two-source.jpg" },
  { id: "pig", label: "小猪 / Pig", hint: "小猪登场 · Original sticker from your photo", src: "/frames/little-pig-source.png" },
] as const;

export type FrameStyle = typeof PHOTO_FRAMES[number]["id"];

export function drawPhotoFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, style: FrameStyle = "dungeon") {
  if (style === "none") return;
  if (style === "dungeon") return drawFoodFrame(ctx, image, width, height);
  if (style === "pig") return drawPigFrame(ctx, image, width, height);
  if (!image.naturalWidth || !image.naturalHeight || width <= 0 || height <= 0) return;
  // Trace the supplied photograph instead of regenerating its artwork. The
  // source pixels inside these paths keep the original eyes, beard and ink.
  const scale = Math.min(width / 1018, height * 0.65 / 646) * 1.3;
  const figures = [
    { x: 76, y: 470, width: 291, height: 495, right: false, trace() {
      ctx.moveTo(78, 548);
      ctx.bezierCurveTo(113, 509, 165, 474, 211, 470);
      ctx.bezierCurveTo(248, 469, 288, 505, 314, 539);
      ctx.bezierCurveTo(347, 578, 358, 618, 360, 650);
      ctx.lineTo(366, 658);
      ctx.lineTo(364, 689);
      ctx.lineTo(357, 704);
      ctx.bezierCurveTo(357, 771, 338, 843, 317, 892);
      ctx.lineTo(306, 932);
      ctx.bezierCurveTo(250, 941, 196, 961, 114, 964);
      ctx.lineTo(99, 958);
      ctx.bezierCurveTo(90, 938, 92, 878, 85, 842);
      ctx.bezierCurveTo(79, 764, 77, 642, 78, 548);
    } },
    { x: 716, y: 319, width: 381, height: 621, right: true, trace() {
      ctx.moveTo(933, 319);
      ctx.bezierCurveTo(886, 326, 836, 361, 824, 402);
      ctx.bezierCurveTo(816, 430, 824, 474, 834, 524);
      ctx.bezierCurveTo(804, 526, 768, 519, 741, 514);
      ctx.bezierCurveTo(727, 510, 720, 506, 718, 512);
      ctx.lineTo(731, 533);
      ctx.lineTo(723, 541);
      ctx.lineTo(725, 550);
      ctx.lineTo(744, 547);
      ctx.bezierCurveTo(779, 567, 815, 598, 852, 617);
      ctx.bezierCurveTo(877, 679, 912, 784, 914, 935);
      ctx.lineTo(1064, 932);
      ctx.bezierCurveTo(1087, 931, 1094, 916, 1094, 894);
      ctx.lineTo(1094, 557);
      ctx.lineTo(1061, 544);
      ctx.bezierCurveTo(1047, 525, 1047, 480, 1044, 429);
      ctx.bezierCurveTo(1042, 366, 1024, 337, 981, 325);
      ctx.bezierCurveTo(963, 319, 945, 317, 933, 319);
    } },
  ];
  for (const figure of figures) {
    ctx.save();
    ctx.translate(figure.right ? width - figure.width * scale : 0, height - figure.height * scale);
    ctx.scale(scale, scale);
    ctx.translate(-figure.x, -figure.y);
    ctx.beginPath();
    figure.trace();
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}

/** Display the supplied pig pixels through a silhouette mask, without redraw. */
export function drawPigFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  if (!image.naturalWidth || !image.naturalHeight || width <= 0 || height <= 0) return;
  // Coordinates follow the 945px-wide reference, independent of source DPI.
  const scale = Math.min(width * .82 / 675, height * .6 / 676);
  ctx.save();
  ctx.translate(width * .06, height * .975 - 676 * scale);
  ctx.scale(scale, scale);
  ctx.translate(-160, -810);
  ctx.beginPath();
  ctx.moveTo(212, 848);
  ctx.bezierCurveTo(219, 845, 256, 870, 278, 891);
  ctx.bezierCurveTo(329, 879, 394, 875, 447, 880);
  ctx.lineTo(486, 819);
  ctx.bezierCurveTo(492, 811, 498, 816, 501, 829);
  ctx.lineTo(518, 883);
  ctx.bezierCurveTo(557, 902, 586, 927, 596, 960);
  ctx.bezierCurveTo(607, 989, 595, 1020, 551, 1044);
  ctx.bezierCurveTo(559, 1074, 547, 1090, 535, 1100);
  ctx.bezierCurveTo(526, 1115, 539, 1134, 545, 1148);
  ctx.bezierCurveTo(555, 1170, 576, 1187, 575, 1207);
  ctx.bezierCurveTo(574, 1226, 559, 1243, 542, 1257);
  ctx.bezierCurveTo(545, 1308, 540, 1345, 519, 1380);
  ctx.lineTo(480, 1457);
  ctx.lineTo(499, 1473);
  ctx.lineTo(503, 1483);
  ctx.lineTo(445, 1483);
  ctx.lineTo(414, 1472);
  ctx.lineTo(334, 1437);
  ctx.lineTo(394, 1365);
  ctx.lineTo(334, 1455);
  ctx.lineTo(353, 1474);
  ctx.lineTo(355, 1483);
  ctx.lineTo(283, 1482);
  ctx.bezierCurveTo(281, 1434, 280, 1380, 278, 1321);
  ctx.lineTo(190, 1377);
  ctx.bezierCurveTo(176, 1385, 164, 1370, 177, 1358);
  ctx.lineTo(277, 1295);
  ctx.lineTo(276, 1269);
  ctx.bezierCurveTo(269, 1237, 257, 1192, 260, 1167);
  ctx.bezierCurveTo(257, 1147, 261, 1130, 267, 1118);
  ctx.bezierCurveTo(237, 1112, 208, 1107, 190, 1097);
  ctx.bezierCurveTo(164, 1090, 158, 1066, 167, 1037);
  ctx.bezierCurveTo(164, 1006, 178, 976, 192, 950);
  ctx.lineTo(206, 918);
  ctx.lineTo(209, 872);
  ctx.closePath();
  // The opening between the legs remains transparent.
  ctx.moveTo(337, 1436);
  ctx.lineTo(393, 1372);
  ctx.lineTo(414, 1468);
  ctx.closePath();
  ctx.clip("evenodd");
  const referenceHeight = image.naturalHeight * 945 / image.naturalWidth;
  ctx.drawImage(image, 0, 0, 945, referenceHeight);
  ctx.restore();

  // Keep the original white dotted gesture alongside the pig as well.
  ctx.save();
  ctx.translate(width * .06, height * .975 - 676 * scale);
  ctx.scale(scale, scale);
  ctx.translate(-160, -810);
  ctx.beginPath();
  const dashes = [
    [589, 1278, 9, 5, 0], [623, 1284, 13, 5, .13],
    [661, 1298, 14, 5, .45], [695, 1320, 15, 5, .6],
    [727, 1348, 15, 5, .75], [753, 1382, 13, 5, .95],
    [774, 1418, 12, 5, 1.1], [750, 1446, 15, 5, .4],
    [787, 1453, 13, 5, 1.2], [822, 1433, 13, 5, -.7],
  ];
  for (const [x, y, rx, ry, rotation] of dashes) {
    ctx.moveTo(x + Math.cos(rotation) * rx, y + Math.sin(rotation) * rx);
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.drawImage(image, 0, 0, 945, referenceHeight);
  ctx.restore();
}

/** Stretch only the transparent middle and thin edge sections, never the characters. */
export function drawFoodFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const sw = image.naturalWidth;
  const sh = image.naturalHeight;
  if (!sw || !sh || width <= 0 || height <= 0) return;
  const cornerWidth = Math.floor(sw * 0.34);
  const topHeight = Math.floor(sh * 0.46);
  const bottomHeight = Math.floor(sh * 0.53);
  const scale = Math.min(width / sw, height / sh);
  const sx = [0, cornerWidth, sw - cornerWidth, sw];
  const sy = [0, topHeight, sh - bottomHeight, sh];
  const dx = [0, cornerWidth * scale, width - cornerWidth * scale, width];
  const dy = [0, topHeight * scale, height - bottomHeight * scale, height];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // Draw the straight gold rails independently. Sampling a vertical strip
      // from this illustration would stretch tiny pieces of hair or ribbon.
      if (row === 1 && col !== 1) {
        const previousFill = ctx.fillStyle;
        ctx.fillStyle = "#ad8739";
        const lineWidth = Math.max(0.75, 2 * scale);
        for (const inset of [9 * scale, 22 * scale]) {
          ctx.fillRect(col === 0 ? inset : width - inset - lineWidth, dy[row], lineWidth, dy[row + 1] - dy[row]);
        }
        ctx.fillStyle = previousFill;
        continue;
      }
      ctx.drawImage(image, sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row], dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]);
    }
  }
}
