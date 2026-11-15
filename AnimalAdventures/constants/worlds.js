/**
 * The world map menu, described as data.
 *
 * Each menu category is one "world" - a full-screen scene the child swipes
 * between. Adding a game to the map is one `landmarks` entry here; layout
 * and art stay out of the components.
 *
 * Art is Kenney's "Background Elements Redux" (CC0, see
 * assets/backgrounds/kenney/LICENSE-*.txt). Its layers are flat one-colour
 * silhouettes, so each is tinted per biome instead of shipping a copy per
 * colour.
 *
 * Positions are the centre of a landmark as a fraction of the page width
 * and height. `p` is portrait, `l` is landscape.
 *
 * Layer `factor` is the parallax speed: 0 moves with the page, 1 holds still
 * against the screen. Far layers get small numbers, near ones large.
 */

const IMG = {
  bgGrass: require('../assets/backgrounds/kenney/backgroundColorGrass.png'),
  bgForest: require('../assets/backgrounds/kenney/backgroundColorForest.png'),
  bgFall: require('../assets/backgrounds/kenney/backgroundColorFall.png'),
  bgDesert: require('../assets/backgrounds/kenney/backgroundColorDesert.png'),
  hills: require('../assets/backgrounds/kenney/elements/hillsLarge.png'),
  mountains: require('../assets/backgrounds/kenney/elements/mountains.png'),
  ground: require('../assets/backgrounds/kenney/elements/groundLayer1.png'),
  cloud1: require('../assets/backgrounds/kenney/sprites/cloud1.png'),
  cloud3: require('../assets/backgrounds/kenney/sprites/cloud3.png'),
  sun: require('../assets/backgrounds/kenney/sprites/sun.png'),
  moon: require('../assets/backgrounds/kenney/sprites/moon.png'),
  palm: require('../assets/backgrounds/kenney/sprites/treePalm.png'),
  tree: require('../assets/backgrounds/kenney/sprites/tree.png'),
  treeLong: require('../assets/backgrounds/kenney/sprites/treeLong.png'),
  pineSnow: require('../assets/backgrounds/kenney/sprites/treePineSnow.png'),
  treeFrozen: require('../assets/backgrounds/kenney/sprites/treeFrozen.png'),
  bush: require('../assets/backgrounds/kenney/sprites/bush1.png'),
  fence: require('../assets/backgrounds/kenney/sprites/fence.png'),
  house: require('../assets/backgrounds/kenney/sprites/house1.png'),
};

/**
 * `band`: a tinted full-width silhouette hugging the bottom, `h` its height
 * as a fraction of the page. `decor`: a sprite standing on the ground,
 * `x` a fraction of the page width, `bottom` a fraction of the page height
 * up from the bottom, `w` its width in dp at phone scale.
 */
export const WORLDS = [
  {
    key: 'listen',
    // A resident animal that reacts when tapped (portrait only - there is
    // no spare room beside the landmarks on a phone on its side). Stands
    // centred between the dog and the treasure chest.
    idleAnimal: { id: 'monkey' },
    category: 'listen',
    titleKey: 'categoryListen',
    glyph: 'hearing',
    sky: '#BFE9D2',
    skyImage: IMG.bgForest,
    sun: IMG.sun,
    clouds: [
      { img: IMG.cloud1, x: 0.1, y: 0.12, w: 120 },
      { img: IMG.cloud3, x: 0.62, y: 0.2, w: 140 },
    ],
    bands: [
      { img: IMG.hills, tint: '#7CCB8E', h: 0.38, factor: 0.25 },
      { img: IMG.ground, tint: '#3DBE84', h: 0.24, factor: 0.55 },
    ],
    decor: [
      { img: IMG.palm, x: 0.04, bottom: 0.2, w: 110, factor: 0.7 },
      { img: IMG.palm, x: 0.8, bottom: 0.24, w: 90, factor: 0.5 },
      { img: IMG.bush, x: 0.45, bottom: 0.12, w: 90, factor: 0.9 },
    ],
    landmarks: [
      { mode: 'guess', p: [0.3, 0.24], l: [0.2, 0.4] },
      { mode: 'whoseSound', p: [0.7, 0.38], l: [0.5, 0.46] },
      { mode: 'learn', p: [0.3, 0.52], l: [0.8, 0.4] },
    ],
  },
  {
    key: 'letters',
    // A resident animal that reacts when tapped (portrait only - there is
    // no spare room beside the landmarks on a phone on its side). Stands
    // centred between the dog and the treasure chest.
    idleAnimal: { id: 'chicken' },
    category: 'letters',
    titleKey: 'categoryLetters',
    glyph: 'sort-by-alpha',
    sky: '#CDEBFF',
    skyImage: IMG.bgGrass,
    sun: IMG.sun,
    clouds: [
      { img: IMG.cloud3, x: 0.55, y: 0.1, w: 130 },
      { img: IMG.cloud1, x: 0.05, y: 0.22, w: 100 },
    ],
    bands: [
      { img: IMG.hills, tint: '#A6DB7B', h: 0.36, factor: 0.25 },
      { img: IMG.ground, tint: '#7BC85A', h: 0.22, factor: 0.55 },
    ],
    decor: [
      { img: IMG.house, x: 0.74, bottom: 0.2, w: 90, factor: 0.45 },
      { img: IMG.tree, x: 0.04, bottom: 0.18, w: 60, factor: 0.7 },
      { img: IMG.fence, x: 0.4, bottom: 0.1, w: 100, factor: 0.9 },
    ],
    landmarks: [
      { mode: 'letter', p: [0.28, 0.21], l: [0.15, 0.4] },
      { mode: 'lastLetter', p: [0.72, 0.32], l: [0.38, 0.46] },
      { mode: 'trace', p: [0.28, 0.43], l: [0.62, 0.4] },
      { mode: 'counting', p: [0.72, 0.54], l: [0.85, 0.46] },
    ],
  },
  {
    key: 'memory',
    // A resident animal that reacts when tapped (portrait only - there is
    // no spare room beside the landmarks on a phone on its side). Stands
    // centred between the dog and the treasure chest.
    idleAnimal: { id: 'dolphin' },
    category: 'memory',
    titleKey: 'categoryMemory',
    glyph: 'visibility',
    sky: '#BDE3FF',
    skyImage: null,
    sun: IMG.sun,
    clouds: [{ img: IMG.cloud1, x: 0.3, y: 0.1, w: 120 }],
    // Swells instead of hills: the same silhouettes tinted sea-blue.
    bands: [
      { img: IMG.hills, tint: '#6DB6F0', h: 0.5, factor: 0.2 },
      { img: IMG.ground, tint: '#4D9DE8', h: 0.4, factor: 0.45 },
      { img: IMG.ground, tint: '#2F7FCB', h: 0.26, factor: 0.7 },
    ],
    decor: [],
    landmarks: [
      { mode: 'memory', p: [0.28, 0.21], l: [0.2, 0.4] },
      { mode: 'findAnimal', p: [0.72, 0.33], l: [0.5, 0.46] },
      { mode: 'missing', p: [0.28, 0.5], l: [0.8, 0.4] },
    ],
  },
  {
    key: 'create',
    // A resident animal that reacts when tapped (portrait only - there is
    // no spare room beside the landmarks on a phone on its side). Stands
    // centred between the dog and the treasure chest.
    idleAnimal: { id: 'bear-walking' },
    category: 'create',
    titleKey: 'categoryCreate',
    glyph: 'palette',
    sky: '#E6F4FF',
    skyImage: null,
    sun: IMG.moon,
    clouds: [
      { img: IMG.cloud3, x: 0.08, y: 0.14, w: 120 },
      { img: IMG.cloud1, x: 0.64, y: 0.08, w: 110 },
    ],
    bands: [
      { img: IMG.mountains, tint: '#C5DDF2', h: 0.42, factor: 0.2 },
      { img: IMG.hills, tint: '#EAF4FC', h: 0.34, factor: 0.4 },
      { img: IMG.ground, tint: '#FFFFFF', h: 0.2, factor: 0.65 },
    ],
    decor: [
      { img: IMG.pineSnow, x: 0.04, bottom: 0.2, w: 70, factor: 0.7 },
      { img: IMG.treeFrozen, x: 0.82, bottom: 0.2, w: 60, factor: 0.6 },
    ],
    landmarks: [
      { mode: 'buildScene', p: [0.28, 0.21], l: [0.2, 0.4] },
      { mode: 'coloring', p: [0.72, 0.33], l: [0.5, 0.46] },
      { mode: 'band', p: [0.28, 0.5], l: [0.8, 0.4] },
    ],
  },
];
