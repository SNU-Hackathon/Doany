// Assets mapping for Evo character and level progression
// Uses require() for static bundling in Expo

export const Images = {
  home: {
    basic: require('../assets/images/home_basic.png'),
    mesozoic: require('../assets/images/home_Mesozoic.png'),
    paleolithic: require('../assets/images/home_Paleolithic.png'),
  },
  levelMap: require('../assets/images/level_map.png'),
  homeItem: {
    character: require('../assets/images/home_item/character.png'),
    clothes: require('../assets/images/home_item/clothes.png'),
    stores: require('../assets/images/home_item/stores.png'),
    maps: require('../assets/images/home_item/maps.png'),
  },
  levels: {
    locked: require('../assets/images/levels/Group 43.png'),
    current: require('../assets/images/levels/Group 44.png'),
    dotsH: require('../assets/images/levels/Vector 1.png'),
    dotsV: require('../assets/images/levels/Vector 2.png'),
  },
} as const;

export type EraKey = 'basic' | 'mesozoic' | 'paleolithic';

