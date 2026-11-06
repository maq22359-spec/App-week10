import test from 'node:test';
import assert from 'node:assert/strict';
import { cropFrame, previewCrop, makeStrip, takePhoto, PHOTO_COUNT, PHOTO_WIDTH, PHOTO_HEIGHT, STRIP_BORDER, STRIP_GAP, STRIP_FOOTER } from '../app/photo.ts';

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
