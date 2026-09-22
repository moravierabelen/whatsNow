import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL's own auto-cleanup only registers itself when it finds a global
// `afterEach` (i.e. with vitest's `test.globals: true`); this project
// imports test functions explicitly instead, so without this, DOM from one
// `render()` in a test file leaks into the next `it` in the same file.
afterEach(() => {
  cleanup()
})
