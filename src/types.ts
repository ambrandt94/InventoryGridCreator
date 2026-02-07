// --- Utility Types ---

export type ValueOf<T> = T[keyof T];

// --- Simulation Constants & Types ---

export const BIOMES = {
  WATER: { id: 'water', color: '#1e3a8a', label: 'Deep Ocean', icon: 'Waves', walkable: false },
  PLAINS: { id: 'plains', color: '#86efac', label: 'Grasslands', icon: 'Tent', walkable: true },
  FOREST: { id: 'forest', color: '#166534', label: 'Ancient Forest', icon: 'Trees', walkable: true },
  MOUNTAIN: { id: 'mountain', color: '#57534e', label: 'High Peaks', icon: 'Mountain', walkable: true },
  CITY: { id: 'city', color: '#eab308', label: 'Capital City', icon: 'Castle', walkable: true },
  BADLANDS: { id: 'badlands', color: '#7f1d1d', label: 'Cursed Lands', icon: 'Skull', walkable: true },
} as const;

export type Biome = ValueOf<typeof BIOMES>;
export type BiomeId = Biome['id'];

export const CRAFTING_STATIONS = {
  BLACKSMITH: { id: 'blacksmith', label: 'Blacksmith', color: '#cbd5e1', icon: 'Hammer', resource: 'ore' },
  CARPENTER: { id: 'carpenter', label: 'Carpenter', color: '#d97706', icon: 'Axe', resource: 'tree' },
  STONECUTTER: { id: 'stonecutter', label: 'Stonecutter', color: '#78716c', icon: 'Pickaxe', resource: 'stone' },
  ALCHEMIST: { id: 'alchemist', label: 'Alchemist', color: '#a855f7', icon: 'FlaskConical', resource: 'plant' },
  SCRIBE: { id: 'scribe', label: 'Scribe', color: '#1e40af', icon: 'Book', resource: 'ruin' }, // Scribes study ruins
  ENCHANTER: { id: 'enchanter', label: 'Enchanter', color: '#db2777', icon: 'Sparkles', resource: 'meat' } // Magic from life essence
};

export type CraftingStation = ValueOf<typeof CRAFTING_STATIONS>;

export const ENTITY_TYPES = {
  HERO: { id: 'hero', label: 'Hero', color: '#facc15', shape: 'star', speed: 0.37, maxHp: 150, baseDmg: 15, hostile: false },
  VILLAGER: { id: 'villager', label: 'Villager', color: '#e5e7eb', shape: 'circle', speed: 0.2, maxHp: 60, baseDmg: 4, hostile: false },
  MONSTER: { id: 'monster', label: 'Monster', color: '#ef4444', shape: 'triangle', speed: 0.27, maxHp: 100, baseDmg: 10, hostile: true },
  ANIMAL: { id: 'animal', label: 'Wildlife', color: '#a3e635', shape: 'rect', speed: 0.17, maxHp: 30, baseDmg: 2, hostile: false },
} as const;

export type EntityType = ValueOf<typeof ENTITY_TYPES>;
export type EntityTypeId = EntityType['id'];

export const RESOURCE_TYPES = {
  TREE: { id: 'tree', color: '#064e3b', label: 'Timber', baseValue: 5, food: 0, replenishes: false },
  FRUIT_TREE: { id: 'fruit_tree', color: '#15803d', label: 'Apple Tree', baseValue: 2, food: 20, replenishes: true, respawnTicks: 2000 },
  BERRY_BUSH: { id: 'berry_bush', color: '#be185d', label: 'Berries', baseValue: 1, food: 10, replenishes: true, respawnTicks: 1000 },
  STONE: { id: 'stone', color: '#78716c', label: 'Stone', baseValue: 8, food: 0, replenishes: false },
  ORE: { id: 'ore', color: '#f59e0b', label: 'Gold Ore', baseValue: 15, food: 0, replenishes: false },
  PLANT: { id: 'plant', color: '#bef264', label: 'Herbs', baseValue: 3, food: 5, replenishes: true, respawnTicks: 500 },
  RUIN: { id: 'ruin', color: '#4c1d95', label: 'Ancient Relic', baseValue: 50, food: 0, replenishes: false },
  MEAT: { id: 'meat', color: '#f87171', label: 'Raw Meat', baseValue: 5, food: 40, replenishes: false },
} as const;

export type ResourceType = ValueOf<typeof RESOURCE_TYPES>;

export const QUALITIES = [
  { id: 'poor', label: 'Poor', mult: 0.8, color: '#94a3b8' },
  { id: 'common', label: 'Common', mult: 1.0, color: '#e2e8f0' },
  { id: 'fine', label: 'Fine', mult: 1.5, color: '#60a5fa' },
  { id: 'mythic', label: 'Mythic', mult: 3.0, color: '#d8b4fe' },
] as const;

export type Quality = ValueOf<typeof QUALITIES>;

export const WEAPONS = [
    { name: 'Fists', dmg: 1 },
    { name: 'Rusty Sword', dmg: 5 },
    { name: 'Iron Axe', dmg: 8 },
    { name: 'Mithril Blade', dmg: 15 },
    { name: 'Wooden Club', dmg: 3 },
    { name: 'Vorpal Blade', dmg: 25 },
] as const;

export type Weapon = ValueOf<typeof WEAPONS>;

// --- Simulation Data Structures ---

export interface Resource {
    id: string;
    x: number;
    y: number;
    type: ResourceType;
    quality: Quality;
    depletedUntil: number;
}

export interface Settlement {
    type: string;
    name?: string;
    tier: number,
    resources: number,
    stations: CraftingStation[],
    x: number;
    y: number;
}

export interface Node {
    id: number;
    x: number;
    y: number;
    biome: Biome;
    resources: Resource[];
    settlement: Settlement | null;
}

export interface Entity {
    id: number;
    name: string;
    type: EntityType;
    nodeId: number;
    localX: number;
    localY: number;
    dx: number;
    dy: number;
    state: string;
    goal: string,
    goalTargetId: number | null,
    goalDescription: string,
    profession: string,
    targetNodeId: number | null;
    hp: number;
    maxHp: number;
    gold: number;
    hunger: number;
    inventory: (ResourceType & { quality: Quality })[];
    weapon: Weapon;
    cooldown: number;
}