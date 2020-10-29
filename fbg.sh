#!/bin/bash
rm -rf ~/FreeBoardGames.org/web/src/games/film/*
cp -r ~/filmcentenary/fbg/film/* ~/FreeBoardGames.org/web/src/games/film
cp -r ~/filmcentenary/src/* ~/FreeBoardGames.org/web/src/games/film
rm   ~/FreeBoardGames.org/web/src/games/film/index.tsx
rm   ~/FreeBoardGames.org/web/src/games/film/react-app-env.d.ts
