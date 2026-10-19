#!/usr/bin/env bash
# Baixa o motor (release fixa), o harness do OrcaWasm e os perfis do Orca na MESMA versão do motor (v2.4.2).
set -euo pipefail
cd "$(dirname "$0")"
TAG=wasm-v2.4.2-patch29-multithreaded
mkdir -p engine vendor
for f in slicer-mt.js slicer-mt.wasm; do
  [ -s engine/$f ] || curl -fsSL -o engine/$f "https://github.com/Hiosdra/OrcaWasm/releases/download/$TAG/$f"
done
echo "SHA-256 do wasm (esperado 34614074...ed574b0):"; sha256sum engine/slicer-mt.wasm
[ -d vendor/OrcaWasm ] || { git clone -q https://github.com/Hiosdra/OrcaWasm.git vendor/OrcaWasm && git -C vendor/OrcaWasm checkout -q 60a09e0; }
if [ ! -d vendor/orca-profiles ]; then
  git clone -q --depth 1 --branch v2.4.2 --filter=blob:none --sparse https://github.com/OrcaSlicer/OrcaSlicer.git vendor/orca-profiles
  git -C vendor/orca-profiles sparse-checkout set resources/profiles/Creality
fi
node build-bundle.mjs
echo "setup ok"
