#!/bin/bash
rm -rf ~/WebstormProjects/fbg/web/src/games/film/*
cp -r ~/WebstormProjects/web/fbg/film/* ~/WebstormProjects/fbg/web/src/games/film
cp -r ~/WebstormProjects/web/src/* ~/WebstormProjects/fbg/web/src/games/film
rm   ~/WebstormProjects/fbg/web/src/games/film/index.tsx
rm   ~/WebstormProjects/fbg/web/src/games/film/react-app-env.d.ts
