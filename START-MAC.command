#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS from https://nodejs.org/ and run this file again.'
  read -r answer
  exit 1
fi
npm run local -- --open
