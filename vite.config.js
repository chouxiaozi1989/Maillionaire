import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // 使用相对路径，确保 Electron 打包后能正确加载资源
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // 确保 OAuth2 回调可以正常工作
    cors: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 确保生成的路径使用相对路径
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
