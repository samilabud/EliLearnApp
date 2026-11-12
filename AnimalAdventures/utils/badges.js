/**
 * Album badges.
 *
 * Every badge is derived from progress the app already keeps on the device
 * (animals met, stars earned, play streak), so nothing new is collected and
 * nothing leaves the phone. A badge is either earned or not yet - there is
 * no losing one, and no ranking against anyone.
 */

export const BADGE_DEFS = [
  { id: 'animals-5', kind: 'animals', target: 5, icon: 'pets' },
  { id: 'animals-12', kind: 'animals', target: 12, icon: 'pets' },
  { id: 'animals-all', kind: 'animals', target: 'all', icon: 'emoji-events' },
  { id: 'stars-10', kind: 'stars', target: 10, icon: 'star' },
  { id: 'stars-25', kind: 'stars', target: 25, icon: 'star' },
  { id: 'streak-3', kind: 'streak', target: 3, icon: 'local-fire-department' },
  { id: 'streak-5', kind: 'streak', target: 5, icon: 'local-fire-department' },
];

/**
 * @param {{metCount: number, animalTotal: number, starTotal: number,
 *   bestStreak: number}} progress
 * @returns {Array<{id: string, kind: string, count: number, icon: string,
 *   earned: boolean}>}
 */
export const computeBadges = ({
  metCount,
  animalTotal,
  starTotal,
  bestStreak,
}) =>
  BADGE_DEFS.map(def => {
    const count = def.target === 'all' ? animalTotal : def.target;
    const value =
      def.kind === 'animals'
        ? metCount
        : def.kind === 'stars'
          ? starTotal
          : bestStreak;
    return {
      id: def.id,
      kind: def.kind,
      icon: def.icon,
      count,
      all: def.target === 'all',
      earned: animalTotal > 0 && value >= count,
    };
  });
