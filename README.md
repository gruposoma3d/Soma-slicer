# Soma 3D Web Slicer

Slicer FDM gratuito que roda **100% no navegador** (WebAssembly), usando o motor real do OrcaSlicer via OrcaWasm.
Nenhum modelo é enviado a servidores. Estado atual: **Fase 2b — página de teste do motor para celular**.

## Publicar no GitHub Pages
1. Suba o conteúdo deste repositório para a branch `main`.
2. `Settings → Pages → Build and deployment → Source: GitHub Actions`.
3. Aba `Actions` → workflow **Deploy GitHub Pages** (roda a cada push; ou `Run workflow`).
4. A URL aparece no job `deploy` e em `Settings → Pages`.

O workflow baixa o motor da release pinada e confere o SHA-256 (`engine.lock`); o `.wasm` (27,7 MiB) não é commitado.

## Desenvolvimento local
    cd tools && bash setup.sh && node poc-slice.mjs     # fatiamento em Node; saída em tools/out/

## Licença
AGPL-3.0. Veja `LICENSE` e `NOTICE.md`.
