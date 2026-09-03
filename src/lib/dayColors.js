// Palette de couleurs par jour, réutilisée par la carte 3D et les listes de résultats.
export const DAY_COLORS = ['#38BDF8', '#F59E0B', '#34D399', '#F472B6', '#A78BFA', '#FB923C', '#22D3EE'];

export function dayColor(dayIdx) {
  return DAY_COLORS[dayIdx % DAY_COLORS.length];
}
