#!/bin/bash
rm -rf ~/ft/build/*
tsc-bundle tsconfig.server.json
cp -r ~/filmcentenary/build/* ~/ft/build
