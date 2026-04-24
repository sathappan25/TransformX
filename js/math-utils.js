export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function normalizeAngle(degrees) {
  let value = degrees;

  while (value > 180) {
    value -= 360;
  }

  while (value < -180) {
    value += 360;
  }

  return value;
}
