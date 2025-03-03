import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom', // Vi använder jsdom för att kunna testa DOM-manipulation i React
    setupFiles: ['./src/Tests/setupTests.ts'], // Här kan du peka på en fil där du lägger global config för tester
    globals: true, // Gör så att t.ex. describe, it, expect är globala
  }
})
