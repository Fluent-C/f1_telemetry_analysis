/**
 * hex 6자리 색상(# 없음)을 amount(0~1)만큼 흰색 방향으로 밝게 조정.
 * RGB 선형 보간: result = original + (255 - original) * amount
 */
export function lightenHex(hex: string, amount = 0.45): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lr = Math.min(255, Math.round(r + (255 - r) * amount))
  const lg = Math.min(255, Math.round(g + (255 - g) * amount))
  const lb = Math.min(255, Math.round(b + (255 - b) * amount))
  return [lr, lg, lb].map(v => v.toString(16).padStart(2, '0')).join('')
}
