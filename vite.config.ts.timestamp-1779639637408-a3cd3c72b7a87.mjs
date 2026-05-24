// vite.config.ts
import { defineConfig } from "file:///sessions/dreamy-loving-lovelace/mnt/aircon-democracy/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/dreamy-loving-lovelace/mnt/aircon-democracy/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///sessions/dreamy-loving-lovelace/mnt/aircon-democracy/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.png"],
      manifest: {
        name: "\uC5D0\uC5B4\uCEE8 \uBBFC\uC8FC\uC8FC\uC758",
        short_name: "\uC5D0\uC5B4\uCEE8\uBBFC\uC8FC",
        description: "\uC9C0\uAE08 \uC774 \uACF5\uAC04\uC758 \uC5D0\uC5B4\uCEE8 \uC758\uACAC\uC744 \uBAA8\uC544\uC694",
        lang: "ko",
        theme_color: "#1B53E5",
        background_color: "#F2F2F7",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZHJlYW15LWxvdmluZy1sb3ZlbGFjZS9tbnQvYWlyY29uLWRlbW9jcmFjeVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2RyZWFteS1sb3ZpbmctbG92ZWxhY2UvbW50L2FpcmNvbi1kZW1vY3JhY3kvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2RyZWFteS1sb3ZpbmctbG92ZWxhY2UvbW50L2FpcmNvbi1kZW1vY3JhY3kvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnaWNvbi5wbmcnXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdcdUM1RDBcdUM1QjRcdUNFRTggXHVCQkZDXHVDOEZDXHVDOEZDXHVDNzU4JyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ1x1QzVEMFx1QzVCNFx1Q0VFOFx1QkJGQ1x1QzhGQycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnXHVDOUMwXHVBRTA4IFx1Qzc3NCBcdUFDRjVcdUFDMDRcdUM3NTggXHVDNUQwXHVDNUI0XHVDRUU4IFx1Qzc1OFx1QUNBQ1x1Qzc0NCBcdUJBQThcdUM1NDRcdUM2OTQnLFxuICAgICAgICBsYW5nOiAna28nLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyMxQjUzRTUnLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI0YyRjJGNycsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ2FueSBtYXNrYWJsZScgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHNlcnZlcjogeyBwb3J0OiA1MTczIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVYsU0FBUyxvQkFBb0I7QUFDOVcsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsVUFBVTtBQUFBLE1BQzFCLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLE1BQU07QUFBQSxRQUNOLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxVQUNMLEVBQUUsS0FBSyxhQUFhLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxlQUFlO0FBQUEsUUFDbkY7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsUUFBUSxFQUFFLE1BQU0sS0FBSztBQUN2QixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
