import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    resolve: { tsconfigPaths: true },
    test: {
        environment: "jsdom",
            restoreMocks: true,
        setupFiles: ["./vitest.setup.ts"],
        exclude: ["e2e/**", "node_modules/**"],
        server: {
            deps: {
                inline: ["next-intl", "@mui/material"],
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/__tests__/**",
                "src/**/*.d.ts",
                "src/lib/mock-data.ts",
                "src/lib/i18n/**",
                "src/app/locale/**",
            ],
            thresholds: {
                statements: 48,
                branches: 45,
                functions: 42,
                lines: 48,
            },
        },
    },
});
