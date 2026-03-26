#!/bin/bash

cd "$(dirname "$0")"

echo "Checking dependencies..."
npm install

echo "Starting Crypto Kline Frontend..."
npm start
