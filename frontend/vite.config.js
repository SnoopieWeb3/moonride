import { defineConfig, loadEnv  } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

import obfuscatorPlugin from "vite-plugin-javascript-obfuscator";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    optimizeDeps: {
      exclude: ['@noble/hashes', '@noble/curves']
    },
    plugins: [
      basicSsl(),
      nodePolyfills(),
      react(),
      obfuscatorPlugin({
        exclude: [/node_modules/],
        apply: "build",
        debugger: true,
        options: {
          debugProtection: false,
          compact: true,
          numbersToExpressions: true,
          selfDefending: true,
          stringArray: true,
          stringArrayShuffle: true,
          stringArrayRotate: true,
          stringArrayEncoding: ["base64", "rc4"],
          target: 'browser',
          controlFlowFlattening: true,
          deadCodeInjection: true
        },
      }),
    ]
  }
});