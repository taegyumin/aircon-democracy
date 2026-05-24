#!/usr/bin/env node
// Replaces the black rounded-corner background and its antialiased gray rim
// around app icons with white. Flood fill from each corner consumes any
// near-grayscale, not-already-white pixel — saturated red/blue stays put.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const targets = [
  "public/icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/apple-touch-icon.png",
  "public/favicon-16.png",
  "public/favicon-32.png",
  "dist/icon.png",
  "dist/icon-192.png",
  "dist/icon-512.png",
  "dist/apple-touch-icon.png",
  "dist/favicon-16.png",
  "dist/favicon-32.png",
]
  .map((p) => resolve(projectRoot, p))
  .filter((p) => existsSync(p));

const py = `
import sys
from PIL import Image
from collections import deque

SAT_TOLERANCE = 10   # max(R,G,B) - min(R,G,B) below this => "near grayscale"
WHITE_MIN = 240      # all channels >= this => already white (seed adjacency)
EDGE_MAX = 253       # max channel < this => still visibly darker than white

NEIGHBORS = ((1, 0), (-1, 0), (0, 1), (0, -1))

def whiten(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()

    def is_edge(rgb):
        r, g, b = rgb
        hi, lo = max(r, g, b), min(r, g, b)
        return (hi - lo) <= SAT_TOLERANCE and hi < EDGE_MAX

    def is_white(rgb):
        return rgb[0] >= WHITE_MIN and rgb[1] >= WHITE_MIN and rgb[2] >= WHITE_MIN

    # Seed: every gray-ish pixel that already touches a white pixel.
    # Saturated red/blue (and their pink/light-blue antialiased rims) are
    # rejected by is_edge, so they form a barrier the fill cannot cross.
    q = deque()
    in_queue = [[False] * h for _ in range(w)]
    for x in range(w):
        for y in range(h):
            if not is_edge(px[x, y]):
                continue
            for dx, dy in NEIGHBORS:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and is_white(px[nx, ny]):
                    q.append((x, y))
                    in_queue[x][y] = True
                    break

    changed = 0
    while q:
        x, y = q.popleft()
        in_queue[x][y] = False
        if not is_edge(px[x, y]):
            continue
        px[x, y] = (255, 255, 255)
        changed += 1
        for dx, dy in NEIGHBORS:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not in_queue[nx][ny] and is_edge(px[nx, ny]):
                q.append((nx, ny))
                in_queue[nx][ny] = True

    img.save(path, optimize=True)
    print(f"{path}: {w}x{h}, {changed} px whitened")

for p in sys.argv[1:]:
    whiten(p)
`;

const result = spawnSync("python3", ["-c", py, ...targets], { stdio: "inherit" });
process.exit(result.status ?? 1);
