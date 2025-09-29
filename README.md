# Pixel Rearrangement Playground

This project contains two complementary ways to experiment with rearranging the pixels
from one picture so that they approximate another:

- **Interactive web app (`index.html`)** – drop in a source and a target image to see
  the source pixels remapped via a perceptual Lab colour matcher and animated in
  real time with smooth easing.
- **Original research notebook (`pixel_rearrangement.ipynb`)** – retains the earlier
  exploratory workflow in Python for reference.

## Running the web demo locally

1. Launch a simple web server from the repository root (for example with
   `python -m http.server`).
2. Visit `http://localhost:8000` (or whichever port you chose) and open
   `index.html`.
3. Drop or select the source and target images you want to experiment with.
4. Adjust the resolution, animation duration, and pixel scale to balance quality
   versus performance, then press **Play** to watch the transition.

The demo ships with a colourful default pair of SVG-based samples so you can try it
immediately.

## Notes

- Pixel matching is done in CIE Lab space with spatially aware colour buckets.
  This tends to produce tighter matches than simple HSV sorting while remaining
  responsive in the browser.
- The animation system reuses the original source pixel colours, guaranteeing that
  the effect is a true rearrangement rather than recolouring.
- Everything runs client-side; no images are uploaded or stored remotely.
