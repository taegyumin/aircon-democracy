# Aircon Democracy Code Style Guide

2026-05-29 — LLM V4 리뷰 산출물 (D)를 base로 한 미니 스타일 가이드. 강제 rule은 ESLint에 위임 가능한 부분만, 나머지는 가이드로.

## Naming
- Component files use `PascalCase.tsx`; provider, hook, route, utility files use `camelCase.ts`.
- Functions should prefer domain verbs: `verifyTrain`, `listTrainCities`, `buildBusPlace`.
- Event handlers may use `handleXChange`; async attempts may use `tryX` only when failure is expected UI flow.
- Boolean state uses `is/has/can/should` when it describes a derived condition. Short state adjectives like `matched`, `verifying`, `cancelled`, `submitting` are allowed for local UI state.
- Place ID prefixes are domain compatibility, not style cleanup targets. Do not rename existing IDs for cosmetic consistency.

## Korean and English
- Code identifiers are English.
- User-visible copy is Korean.
- Developer logs, internal error names, and API reason codes are English snake_case.
- Korean comments are allowed when they explain domain policy, external API quirks, or regression history.

## Types
- Use `interface` for object-shaped props, provider contracts, and DTO-like models.
- Use `type` for unions, discriminated unions, mapped types, and utility compositions.
- Prefer `satisfies` for object literals that must match a domain shape.
- Avoid `as` outside boundary code. Allowed boundaries: JSON parsing, DOM/native APIs, test fixtures, third-party SDKs.
- Prefer `unknown` plus narrowing over `any`. Tests may use narrow fixture helpers instead of `as any`.

## Errors
- API/server reason codes stay machine-readable: `not_found`, `service_closed`, `no_vehicle_at_stop`.
- UI maps reason codes through copy tables, not inline ternaries in JSX (`TRAIN_VERIFY_ERROR_COPY`, `INTERCITY_BUS_VERIFY_ERROR_COPY` 예시).
- Do not show raw server stack/error messages to users. Use raw messages only for local developer diagnostics.
- Use a small helper for caught errors, e.g. `messageFromUnknown(e)`, instead of repeated `(e as Error).message`.

## Hooks
- Fetch effects must protect against stale writes with one of the standard patterns:
  - `AbortController` when the API supports abort.
  - `seqRef` for autocomplete/race ordering.
  - effect-scoped `cancelled` flag for timeout/debounce cleanup.
- Do not call `setState` in cleanup. Cleanup only flips flags, clears timers, or aborts requests.
- If an effect reads a value, include it in deps or snapshot it before the effect with a comment explaining why.
- Optional chain deps: extract `s?.field` to a local const before useEffect so dep array is `[field]` not `[s]`.

## Comments
- Comments should explain why, not restate what.
- Good: `// TAGO returns station-level only; vehicle mode is intentionally disabled.`
- Bad: `// set loading to true`
- Keep regression comments with dates only when they prevent repeated debugging.

## Imports
- Order imports as:
  1. React / framework / third-party
  2. `@aircon/*`
  3. app absolute aliases
  4. relative imports
  5. side-effect imports
- Type-only imports should use `import type`.
- All imports stay at file top. No mid-file imports.

## RN-specific
- Use `StyleSheet.create` for stable styles. Dynamic color/value inline is allowed; spacing should be in named styles (`styles.sectionGap`).
- Always use `!!` to coerce string state in `style={[base, !!value && extra]}` — empty string is not falsy in RN style type narrowing.
- Use `Pressable` over `TouchableOpacity` for new code.
- Use `SafeAreaView` from `react-native-safe-area-context` (not core RN).

## ESLint rules already enforced
- `react-hooks/rules-of-hooks: error`
- `react-hooks/exhaustive-deps: warn` (sweep 후 0건 유지)

## ESLint rules 후속 (#147 검토 후)
- `@typescript-eslint/no-explicit-any` (src error, tests warn) — 현재 6건
- `@typescript-eslint/consistent-type-imports`
- `simple-import-sort/imports`
- `react-native/no-inline-styles` (mobile warn only)
