# These two: original-pixel frame

The selected asset is `public/frames/these-two-source.jpg`, copied from the photograph supplied by the user. Its two printed figures are displayed using individually traced Canvas clipping paths in `app/frame.ts`.

The renderer draws the original pixels inside the silhouette masks. It does not redraw or regenerate the faces, glasses, beard, pointing arm, paper shading, or ink lines. Each figure is uniformly scaled and anchored to its own lower corner. The camera remains visible everywhere outside the two masks. Preview and photo export use the same renderer.

An imagegen background-extraction attempt was evaluated and discarded because it changed some linework. No generated replacement is used for this frame.

The white introduction sidebar was removed as the second step. Desktop now uses the full viewport; phones retain a 9:16 camera view on a dark background.
