/** Web only (see diag.web.ts); the phone build records nothing. */
export function diag(_k: string, _data: Record<string, unknown> = {}): void {}
export function diagAction(_label: string): void {}
export function startDiagnostics(): void {}
