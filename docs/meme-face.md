# Meme Face

The `/meme` route is a local camera and meme-composition flow. The supplied blank template and finished reference are served from `public/memes`. Single-photo capture is the default; an optional mode takes four separate expressions and creates a vertical strip. The sample demo uses the one supplied reference image and repeats it when strip mode is selected.

The semi-transparent SVG template overlay and PNG composition share `MEME_TARGETS` in `app/meme/processing.ts`. Each eye, the nose and the mouth is independently anchored to its matching opening. Every source pixel belongs to at most one feature mask, preventing duplicate eyes when source crop rectangles overlap. Uniform per-feature scaling preserves feature proportions. Local luminance normalization and a feathered alpha mask remove background, hair and outer face contours without an external image-generation request.

Only the native share action sends a user-selected output to a share target. Photos and facial landmarks are otherwise kept in memory on the device.

## Runtime sources

- SDK: `@mediapipe/tasks-vision` version 1.2.2 from npm; local WebAssembly/runtime copies are in `public/mediapipe`.
- SDK license: Apache 2.0; official license included as `public/mediapipe/LICENSE`.
- Model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Official model/API guide: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js

The native runtime's informational XNNPACK initialization line is forwarded to `console.info` instead of `console.error` while creating or running the detector; actual errors remain errors.
