#!/bin/bash
rm -rf ~/ft/build/*
tsc-bundle tsconfig.server.json
cp ~/filmcentenary/build/* ~/ft/build
