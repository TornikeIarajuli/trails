const TITLES = [
  { min: 100, label: 'Legend of the Peaks', emoji: '👑' },
  { min: 60,  label: 'Mountain Master',     emoji: '🦅' },
  { min: 30,  label: 'Senior Hiker',        emoji: '🏔️' },
  { min: 15,  label: 'Trail Veteran',       emoji: '⛰️' },
  { min: 5,   label: 'Trail Adventurer',    emoji: '🧭' },
  { min: 1,   label: 'Trail Explorer',      emoji: '🥾' },
  { min: 0,   label: 'Trail Wanderer',      emoji: '🌱' },
];

export function getUserTitle(totalCompletions: number): { label: string; emoji: string } {
  for (const t of TITLES) {
    if (totalCompletions >= t.min) return t;
  }
  return TITLES[TITLES.length - 1];
}
