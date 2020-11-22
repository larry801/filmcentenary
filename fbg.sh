#!/bin/bash
rm -rf ~/WebstormProjects/fbg/web/src/games/film/*
cp -r ~/WebstormProjects/web/fbg/film/* ~/WebstormProjects/fbg/web/src/games/film
cp -r ~/WebstormProjects/web/src/* ~/WebstormProjects/fbg/web/src/games/film
rm   ~/WebstormProjects/fbg/web/src/games/film/index.tsx
rm   ~/WebstormProjects/fbg/web/src/games/film/react-app-env.d.ts
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/components/lobby
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/components/join
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/components/local
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/components/single
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/debugApp
rm -rf  ~/WebstormProjects/fbg/web/src/games/film/lobbyDev
rm   ~/WebstormProjects/fbg/web/src/games/film/components/drawer-app-bar.tsx
rm   ~/WebstormProjects/fbg/web/src/games/film/components/create-match.tsx
