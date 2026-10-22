/**
 * Decorative objects a child can drag into Build a Scene alongside animals.
 *
 * Deliberately static (no `sound`/`voice` fields, unlike animalList) - these
 * are set dressing, not something to learn a name or sound for. Kept small
 * and habitat-generic (tree, bush, rock, flower, cloud, sun) rather than
 * tied to any one animal's habitat, so the same set works for a farm, a
 * jungle or an ocean scene.
 */
export const sceneryList = [
  {
    id: 'tree',
    name: 'Tree',
    spanish_name: 'Árbol',
    animation_path: require('../../assets/animations/scenery/tree_icon.json'),
  },
  {
    id: 'bush',
    name: 'Bush',
    spanish_name: 'Arbusto',
    animation_path: require('../../assets/animations/scenery/bush_icon.json'),
  },
  {
    id: 'rock',
    name: 'Rock',
    spanish_name: 'Roca',
    animation_path: require('../../assets/animations/scenery/rock_icon.json'),
  },
  {
    id: 'flower',
    name: 'Flower',
    spanish_name: 'Flor',
    animation_path: require('../../assets/animations/scenery/flower_icon.json'),
  },
  {
    id: 'cloud',
    name: 'Cloud',
    spanish_name: 'Nube',
    animation_path: require('../../assets/animations/scenery/cloud_icon.json'),
  },
  {
    id: 'sun',
    name: 'Sun',
    spanish_name: 'Sol',
    animation_path: require('../../assets/animations/scenery/sun_icon.json'),
  },
];
