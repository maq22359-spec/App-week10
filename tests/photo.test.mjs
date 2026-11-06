import test from 'node:test';
import { drawFoodFrame, drawPhotoFrame } from '../app/frame.ts';
import assert from 'node:assert/strict';
import { cropFrame, previewCrop, makeStrip, makePhotoOutput, takePhoto, PHOTO_COUNT, PHOTO_WIDTH, PHOTO_HEIGHT, STRIP_BORDER, STRIP_GAP, STRIP_FOOTER } from '../app/photo.ts';

test('center crop retains 4:3 composition from landscape, portrait, and square cameras', () => {
  for (const [width, height] of [[1920,1080],[1080,1920],[1280,960],[800,800]]) {
    const crop = cropFrame(width, height);
    assert.ok(Math.abs(crop.width / crop.height - 4 / 3) < 0.0001);
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= width && crop.y + crop.height <= height);
    assert.equal(crop.x * 2 + crop.width, width);
    assert.equal(crop.y * 2 + crop.height, height);
  }
});

test('portrait preview guide maps to the mirrored object-cover camera pixels', () => {
  const crop = previewCrop(1920, 1080, {left:0,top:0,width:390,height:844}, {left:22,top:240,width:346,height:259.5});
  assert.ok(Math.abs(crop.width / crop.height - 4 / 3) < 0.0001);
  assert.ok(crop.x > 0 && crop.y > 0);
  assert.ok(crop.x + crop.width < 1920 && crop.y + crop.height < 1080);
  assert.ok(Math.abs(crop.x + crop.width / 2 - 960) < .001);
});

test('a mirrored off-center guide maps to the opposite source side', () => {
  const crop = previewCrop(1200, 900, {left:0,top:0,width:1200,height:900}, {left:100,top:200,width:400,height:300});
  assert.deepEqual(crop, {x:700,y:200,width:400,height:300});
});

test('capture rejects a paused or empty camera', () => {
  assert.throws(() => takePhoto({videoWidth:0,videoHeight:0,readyState:0}, false), /camera paused/);
});

test('strip requires exactly four photos', async () => {
  await assert.rejects(makeStrip(['one'], new Date()), /all four photos/);
});

test('strip composes four images in order with a white border and PNG export', async () => {
  const draws = [];
  const fills = [];
  const labels = [];
  let canvas;
  const ctx = {
    fillStyle:'',
    fillRect(...args) { fills.push([this.fillStyle, ...args]); },
    drawImage(...args) { draws.push(args); },
    fillText(...args) { labels.push(args); },
  };
  const previousDocument = globalThis.document;
  const previousImage = globalThis.Image;
  globalThis.document = {createElement() { return canvas = {width:0,height:0,getContext:()=>ctx,toBlob(callback,type) {callback(new Blob(['PNG'], {type}));}}; }};
  globalThis.Image = class {set src(value) {this.source = value;queueMicrotask(() => this.onload());}};
  try {
    const blob = await makeStrip(['one','two','three','four'], new Date('2026-11-06T12:00:00Z'));
    assert.equal(blob.type, 'image/png');
    assert.equal(canvas.width, PHOTO_WIDTH + STRIP_BORDER * 2);
    assert.equal(canvas.height, STRIP_BORDER + PHOTO_HEIGHT * PHOTO_COUNT + STRIP_GAP * 3 + STRIP_FOOTER);
    assert.deepEqual(fills[0], ['#ffffff',0,0,canvas.width,canvas.height]);
    assert.deepEqual(draws.map(draw => draw[0].source), ['one','two','three','four']);
    draws.forEach((draw,index) => assert.deepEqual(draw.slice(1), [STRIP_BORDER, STRIP_BORDER + index * (PHOTO_HEIGHT + STRIP_GAP), PHOTO_WIDTH, PHOTO_HEIGHT]));
    assert.equal(labels[0][0], 'little moments');
    assert.match(labels[1][0], /2026/);
  } finally { globalThis.document = previousDocument; globalThis.Image = previousImage; }
});

test('illustrated frame is composited after grayscale without mirroring the artwork', () => {
  const calls = [];
  const artwork = { name: 'food-frame', naturalWidth: 1448, naturalHeight: 1086 };
  const pixels = { data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]) };
  const video = { videoWidth: 1920, videoHeight: 1080, readyState: 4 };
  const ctx = {
    translate(...args) { calls.push(['translate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    drawImage(...args) { calls.push(['draw', ...args]); },
    getImageData() { return pixels; },
    putImageData() { calls.push(['grayscale']); },
    setTransform(...args) { calls.push(['transform', ...args]); },
    fillRect() {},
  };
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:image/jpeg;test' }) };
  try {
    assert.equal(takePhoto(video, true, undefined, artwork), 'data:image/jpeg;test');
    assert.deepEqual([...pixels.data], [54, 54, 54, 255, 182, 182, 182, 128]);
    assert.equal(calls[2][1], video);
    const grayscaleIndex = calls.findIndex(call => call[0] === 'grayscale');
    assert.deepEqual(calls[grayscaleIndex + 1], ['transform', 1, 0, 0, 1, 0, 0]);
    const frameDraws = calls.slice(grayscaleIndex + 2);
    assert.equal(frameDraws.length, 7);
    assert.ok(frameDraws.every(call => call[0] === 'draw' && call[1] === artwork));
  } finally { globalThis.document = previousDocument; }
});

test('responsive artwork reaches all four edges without distorting corner characters', () => {
  const image = { naturalWidth: 1448, naturalHeight: 1086 };
  for (const [width, height] of [[1080, 1920], [1440, 810], [771, 767]]) {
    const draws = [];
    drawFoodFrame({ drawImage(...args) { draws.push(args); }, fillRect() {} }, image, width, height);
    assert.equal(draws.length, 7);
    assert.equal(draws[0][5], 0);
    assert.equal(draws[0][6], 0);
    assert.ok(Math.abs(draws[6][5] + draws[6][7] - width) < 0.001);
    assert.ok(Math.abs(draws[6][6] + draws[6][8] - height) < 0.001);
    for (const index of [0, 2, 4, 6]) {
      const draw = draws[index];
      assert.ok(Math.abs(draw[7] / draw[3] - draw[8] / draw[4]) < 0.001, 'corner must preserve its original aspect ratio');
    }
  }
});

test('phone capture exports a 9:16 image matching the full portrait preview', () => {
  let canvas;
  const ctx = { translate() {}, scale() {}, drawImage() {} };
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas = { getContext: () => ctx, toDataURL: () => 'portrait-photo' } };
  const video = { videoWidth: 1920, videoHeight: 1080, readyState: 4, getBoundingClientRect: () => ({left:0,top:0,width:360,height:640}) };
  try {
    takePhoto(video, false, {left:0,top:0,width:360,height:640});
    assert.equal(canvas.width, 1080);
    assert.equal(canvas.height, 1920);
  } finally { globalThis.document = previousDocument; }
});

test('photo strip keeps the full height of all four 9:16 portrait photos', async () => {
  let canvas;
  const draws = [];
  const ctx = { fillRect() {}, fillText() {}, drawImage(...args) {draws.push(args);} };
  const previousDocument = globalThis.document;
  const previousImage = globalThis.Image;
  globalThis.document = {createElement: () => canvas = {getContext:()=>ctx,toBlob(callback,type) {callback(new Blob(['PNG'], {type}));}}};
  globalThis.Image = class {
    naturalWidth = 1080;
    naturalHeight = 1920;
    set src(value) {queueMicrotask(() => this.onload());}
  };
  try {
    await makeStrip(['one','two','three','four'], new Date());
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 7974);
    assert.deepEqual(draws.map(draw => draw[4]), [1920,1920,1920,1920]);
    assert.deepEqual(draws.map(draw => draw[2]), [60,2004,3948,5892]);
  } finally {globalThis.document = previousDocument;globalThis.Image = previousImage;}
});

test('original meme figures use the source photograph with separate silhouette clips', () => {
  const source = {naturalWidth:1122,naturalHeight:1122};
  const calls = [];
  const ctx = {
    save() {calls.push(['save']);}, restore() {calls.push(['restore']);},
    translate(...args) {calls.push(['translate',...args]);}, scale(...args) {calls.push(['scale',...args]);},
    beginPath() {}, moveTo() {}, bezierCurveTo() {}, lineTo() {}, closePath() {},
    clip() {calls.push(['clip']);}, drawImage(...args) {calls.push(['draw',...args]);},
  };
  for (const [width,height] of [[1080,1920],[1440,810]]) {
    calls.length = 0;
    drawPhotoFrame(ctx,source,width,height,'meme');
    assert.deepEqual(calls.filter(call=>call[0]==='draw'), [['draw',source,0,0],['draw',source,0,0]], 'use original image pixels without generated replacement');
    assert.equal(calls.filter(call=>call[0]==='clip').length,2);
    assert.equal(calls.filter(call=>call[0]==='restore').length,2);
    for (const call of calls.filter(call=>call[0]==='scale')) {
      assert.ok(call[1]>0);
      assert.equal(call[1],call[2], 'figures must not be stretched or mirrored');
    }
  }
});

test('No frame draws no artwork', () => {
  drawPhotoFrame({drawImage(){assert.fail('No frame must not draw');}}, {naturalWidth:1122,naturalHeight:1122},1080,1920,'none');
});


test('single-photo mode exports the original image dimensions without a strip border',async()=>{
  const previousDocument=globalThis.document;
  const previousImage=globalThis.Image;
  let canvas;
  globalThis.Image=class {
    naturalWidth=1080; naturalHeight=1920;
    set src(value){queueMicrotask(()=>this.onload());}
  };
  globalThis.document={createElement:()=>canvas={getContext:()=>({drawImage(){}}),toBlob(callback,type){callback(new Blob(['PNG'],{type}));}}};
  try {
    const blob=await makePhotoOutput(['single-photo'],new Date());
    assert.equal(blob.type,'image/png');
    assert.equal(canvas.width,1080);
    assert.equal(canvas.height,1920);
  } finally {globalThis.document=previousDocument;globalThis.Image=previousImage;}
});
