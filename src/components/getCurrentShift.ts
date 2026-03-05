export function getCurrentShift(): "Morning" | "Evening" | "Night" {
  const now = new Date();
  const hour = now.getHours(); // LOCAL hour (0–23)

  if (hour >= 7 && hour < 15) return "Morning";
  if (hour >= 15 && hour < 23) return "Evening";
  return "Night"; // 23 → 06
}
