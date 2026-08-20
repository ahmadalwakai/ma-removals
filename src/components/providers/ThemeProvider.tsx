"use client";

import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { colors, fontFamilies } from "@/lib/tokens";

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          midnight: { value: colors.midnight },
          emerald: { value: colors.emerald },
          amber: { value: colors.amber },
          crimson: { value: colors.crimson },
          slate: { value: colors.slate },
          surface: { value: colors.surface },
          ink: { value: colors.ink },
          muted: { value: colors.muted },
        },
      },
      fonts: {
        heading: { value: fontFamilies.heading },
        body: { value: fontFamilies.body },
        mono: { value: fontFamilies.mono },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: colors.slate },
          surface: { value: colors.surface },
          brand: { value: colors.midnight },
        },
        fg: {
          DEFAULT: { value: colors.ink },
          muted: { value: colors.muted },
          onBrand: { value: "#FFFFFF" },
        },
        accent: {
          DEFAULT: { value: colors.emerald },
          cta: { value: colors.amber },
          danger: { value: colors.crimson },
        },
      },
    },
  },
});

const system = createSystem(defaultConfig, customConfig);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
