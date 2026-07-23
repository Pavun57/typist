import type { TypistApi } from '../shared/types'

declare global {
  interface Window {
    typist: TypistApi
  }
}

export {}
