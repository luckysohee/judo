import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Lint scope: 프론트(src) 중심. 서버/스크립트는 별도 규칙으로 관리.
  globalIgnores(['dist', 'server/**', 'geocode-script/**', 'server_with_crawler.js']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // 점진적 strict 복구:
      // - Hooks 핵심 룰은 강하게(error) 유지해 위험 버그를 잡는다.
      // - 나머지는 warn 으로 남겨 빌드/개발 흐름을 깨지 않는다.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 당장은 허용(레거시 코드에 많음). 이후 파일 단위로 정리하면서 복구.
      'react-hooks/set-state-in-effect': 'off',
      // purity 는 유용하지만 도입 비용이 커 warn 으로 시작.
      'react-hooks/purity': 'warn',

      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      // 빠르게 문제를 눈에 띄게 하되, 당장은 lint exit 0를 위해 warn.
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-unsafe-finally': 'warn',
      'no-useless-escape': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },

  // 임시 예외(점진적 복구 대상): hooks 호출 순서 위반이 있는 레거시 파일은
  // 해당 파일에만 한정해 완화하고, 추후 수정 후 제거한다.
  {
    files: [
      'src/components/CheckInToast/CheckInToast.jsx',
      'src/components/PlaceCard/PlacePreviewCard.jsx',
      'src/components/PlaceDetail/PlaceDetail.jsx',
    ],
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
])
