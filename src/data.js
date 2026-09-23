// Static game data: grid constants, materials, rooms, jobs, traits, names.

export const W = 40;              // grid columns
export const H = 28;              // grid rows (underground)
export const EX = 20;             // entrance column
export const SEC_PER_HOUR = 4;    // real seconds per in-game hour at 1x
export const DEPTH = 1.4;         // block depth (z)
export const FRONT = DEPTH / 2;
export const ADULT_AGE = 4;       // days
export const ELDER_AGE = 50;
export const BASE_CAP = 60;
export const PANTRY_CAP = 40;

export const MAT = { AIR: 0, TOPSOIL: 1, CLAY: 2, STONE: 3, DEEP: 4, BEDROCK: 5 };
export const MATS = [
  { name: 'Tunnel' },
  { name: 'Topsoil', hard: 1.0, drop: { clay: 1 }, color: 0xa87a50 },
  { name: 'Red Clay', hard: 1.6, drop: { clay: 2 }, color: 0xc47d56 },
  { name: 'Stone', hard: 2.6, drop: { stone: 1 }, color: 0xa39b93 },
  { name: 'Deep Rock', hard: 3.6, drop: { stone: 2 }, color: 0x736a86 },
  { name: 'Bedrock', hard: Infinity, color: 0x3e3744 },
];

export const ORE = { NONE: 0, PEBBLES: 1, COPPER: 2, CRYSTAL: 3 };
export const ORES = [
  null,
  { name: 'Pebbles', drop: { stone: 2 } },
  { name: 'Copper Vein', drop: { copper: 2 } },
  { name: 'Moon Crystal', drop: { crystals: 1 } },
];

export const RESOURCES = [
  { id: 'carrots', icon: '🥕', name: 'Carrots' },
  { id: 'stew', icon: '🍲', name: 'Stew' },
  { id: 'clay', icon: '🧱', name: 'Clay' },
  { id: 'stone', icon: '🪨', name: 'Stone' },
  { id: 'copper', icon: '🟠', name: 'Copper' },
  { id: 'gears', icon: '⚙️', name: 'Gears' },
  { id: 'crystals', icon: '💎', name: 'Moon Crystals', nocap: true },
];
export const RES_ICON = Object.fromEntries(RESOURCES.map(r => [r.id, r.icon]));

// Rooms: anchored at bottom-left cell (x, y). Spots are local (x along width, z depth).
export const ROOMS = {
  burrow: {
    name: 'Cozy Burrow', icon: '🛏️', w: 2, h: 1, cost: { clay: 6 }, work: 4,
    desc: 'Four snug hay nests. Every grown rabbit needs a bed — free beds attract travelers.',
    beds: [{ x: 0.27, z: -0.28 }, { x: 0.75, z: -0.28 }, { x: 1.25, z: -0.28 }, { x: 1.73, z: -0.28 }],
  },
  farm: {
    name: 'Carrot Farm', icon: '🥕', w: 3, h: 1, cost: { clay: 8 }, work: 5, job: 'farmer',
    desc: 'Glow-lamp carrot beds. Farmers harvest carrots here.',
    spots: [{ x: 0.75, z: 0.32 }, { x: 2.25, z: 0.32 }],
  },
  kitchen: {
    name: 'Kitchen', icon: '🍲', w: 2, h: 1, cost: { clay: 6, stone: 4 }, work: 6, job: 'cook',
    desc: 'Cooks turn 2 carrots into a hearty stew — more filling, and it cheers rabbits up.',
    spots: [{ x: 0.42, z: 0.12 }, { x: 0.95, z: 0.12 }],
  },
  pantry: {
    name: 'Pantry', icon: '📦', w: 2, h: 1, cost: { clay: 8 }, work: 4, storage: PANTRY_CAP,
    desc: `+${PANTRY_CAP} storage for every resource. Hungry rabbits snack here.`,
  },
  lounge: {
    name: 'Social Lounge', icon: '🫖', w: 3, h: 1, cost: { clay: 10, stone: 4 }, work: 6,
    desc: 'Rabbits chat, make friends and fall in love here.',
    seats: [{ x: 0.45, z: 0.1 }, { x: 1.1, z: 0.32 }, { x: 1.9, z: 0.32 }, { x: 2.55, z: 0.1 }],
  },
  nursery: {
    name: 'Nursery', icon: '🍼', w: 2, h: 1, cost: { clay: 10, stone: 6 }, work: 7, job: 'caretaker',
    desc: 'Couples raise kits here (3 per nursery). Caretakers help kits grow up faster.',
    cradles: [{ x: 0.35, z: -0.25 }, { x: 1.0, z: -0.3 }, { x: 1.65, z: -0.25 }],
    spots: [{ x: 1.0, z: 0.3 }],
  },
  factory: {
    name: 'Gear Factory', icon: '⚙️', w: 3, h: 1, cost: { stone: 14, copper: 4 }, work: 10, job: 'engineer',
    desc: 'Engineers press 1 copper + 1 stone into a gear.',
    spots: [{ x: 0.55, z: 0.3 }, { x: 2.3, z: 0.3 }],
  },
  council: {
    name: 'Council Hall', icon: '🏛️', w: 3, h: 2, cost: { clay: 10, stone: 20, gears: 8 }, work: 14,
    desc: 'Holds elections for a Chief whose traits boost the whole colony. Unlocks Policies.',
    seats: [{ x: 0.6, z: 0.3 }, { x: 1.5, z: 0.38 }, { x: 2.4, z: 0.3 }],
  },
  clock: {
    name: 'Moonstone Clock', icon: '🌙', w: 3, h: 2, cost: { stone: 40, gears: 30, crystals: 10 }, work: 30,
    desc: 'A legendary wonder of rabbitkind. Complete it to win!',
  },
};
export const ROOM_ORDER = ['burrow', 'farm', 'kitchen', 'pantry', 'lounge', 'nursery', 'factory', 'council', 'clock'];

export const JOBS = {
  free: { name: 'Free Bun', icon: '🐾', desc: 'Helps wherever needed.' },
  builder: { name: 'Digger', icon: '⛏️', desc: 'Digs tunnels and builds rooms.' },
  farmer: { name: 'Farmer', icon: '🌱', room: 'farm', desc: 'Grows carrots at farms.' },
  cook: { name: 'Cook', icon: '🍳', room: 'kitchen', desc: 'Cooks stew in kitchens.' },
  engineer: { name: 'Engineer', icon: '🔧', room: 'factory', desc: 'Makes gears in factories.' },
  caretaker: { name: 'Caretaker', icon: '🧸', room: 'nursery', desc: 'Looks after kits in nurseries.' },
};
export const JOB_ORDER = ['free', 'builder', 'farmer', 'cook', 'engineer', 'caretaker'];

// chief: colony-wide bonus when this rabbit is Chief (mood is additive, others multiply)
export const TRAITS = {
  diligent: { name: 'Diligent', icon: '💪', desc: 'Works 25% faster.', work: 1.25, chief: { work: 1.1, desc: '+10% work speed for everyone' } },
  lazy: { name: 'Lazy', icon: '😴', desc: 'Works 20% slower, but easily content (+4 mood).', work: 0.8, mood: 4, chief: { mood: 4, desc: '+4 mood for everyone (relaxed rules)' } },
  glutton: { name: 'Glutton', icon: '🍽️', desc: 'Gets hungry 50% faster.', hunger: 1.5, chief: { mood: 3, desc: '+3 mood (better snacks for all)' } },
  chatty: { name: 'Chatty', icon: '💬', desc: 'Loves company and makes friends fast.', socialGain: 1.4, socialDecay: 1.3, affinity: 1.4, chief: { social: 1.3, desc: '+30% social gain for everyone' } },
  shy: { name: 'Shy', icon: '🙈', desc: 'Needs less company, but bonds slowly.', socialDecay: 0.6, affinity: 0.6, chief: { energy: 0.9, desc: 'Quiet warren: -10% tiredness' } },
  cheerful: { name: 'Cheerful', icon: '🌞', desc: 'Always sunny (+8 mood).', mood: 8, chief: { mood: 6, desc: '+6 mood for everyone' } },
  grumpy: { name: 'Grumpy', icon: '🌧️', desc: 'Hard to please (-8 mood), bonds slowly.', mood: -8, affinity: 0.7, chief: { work: 1.12, mood: -3, desc: '+12% work, -3 mood (strict chief)' } },
  greenpaw: { name: 'Green Paw', icon: '🌿', desc: '+30% farming.', skill: { farmer: 1.3 }, chief: { farm: 1.25, desc: '+25% farm output' } },
  chef: { name: 'Chef', icon: '🧑‍🍳', desc: '+30% cooking.', skill: { cook: 1.3 }, chief: { cook: 1.25, desc: '+25% cooking speed' } },
  tinkerer: { name: 'Tinkerer', icon: '🔩', desc: '+30% factory work.', skill: { engineer: 1.3 }, chief: { factory: 1.25, desc: '+25% gear production' } },
  strong: { name: 'Strong', icon: '🏋️', desc: '+30% digging and building.', skill: { builder: 1.3 }, chief: { dig: 1.25, desc: '+25% digging & building' } },
  romantic: { name: 'Romantic', icon: '💘', desc: 'Falls in love easily.', romance: 1.6, chief: { birth: 1.4, desc: '+40% chance of new kits' } },
  sleepy: { name: 'Sleepy', icon: '🥱', desc: 'Tires 30% faster.', energy: 1.3, chief: { mood: 2, desc: '+2 mood (siesta culture)' } },
  tireless: { name: 'Tireless', icon: '⚡', desc: 'Tires 30% slower.', energy: 0.7, chief: { energy: 0.85, desc: '-15% tiredness for everyone' } },
};
export const TRAIT_CONFLICTS = [['diligent', 'lazy'], ['chatty', 'shy'], ['cheerful', 'grumpy'], ['sleepy', 'tireless']];

export const COATS = [
  { name: 'Snow', body: 0xf7f2ea, belly: 0xffffff, inner: 0xf6b3c0 },
  { name: 'Cream', body: 0xf0dcb8, belly: 0xfff4e2, inner: 0xf2a9b6 },
  { name: 'Cocoa', body: 0xa8744f, belly: 0xe6c9a8, inner: 0xe9a0a8 },
  { name: 'Ash', body: 0xa7a4ad, belly: 0xe4e1e8, inner: 0xeaa8b8 },
  { name: 'Ginger', body: 0xe0995c, belly: 0xfbe0bf, inner: 0xf2a7a0 },
  { name: 'Midnight', body: 0x4d4146, belly: 0x8c7f84, inner: 0xd98c9c },
  { name: 'Honey', body: 0xd8b36a, belly: 0xf8e8c0, inner: 0xf1a8a8 },
];

export const NAMES = ['Clover', 'Bramble', 'Hazel', 'Pip', 'Thistle', 'Juniper', 'Nutmeg', 'Biscuit', 'Mochi', 'Dandelion',
  'Fennel', 'Sorrel', 'Maple', 'Poppy', 'Willow', 'Barley', 'Pepper', 'Toffee', 'Cocoa', 'Sage', 'Basil', 'Truffle', 'Button',
  'Marigold', 'Acorn', 'Pumpkin', 'Nibbles', 'Cinnamon', 'Rosie', 'Olive', 'Parsnip', 'Turnip', 'Hopkins', 'Fluff', 'Clementine',
  'Primrose', 'Dewdrop', 'Buttercup', 'Bartholomew', 'Figgy', 'Quill', 'Tansy', 'Wren', 'Moss', 'Ember', 'Pebble', 'Sprout',
  'Honey', 'Chestnut', 'Radish', 'Snowdrop', 'Bluebell', 'Waffles', 'Dumpling', 'Peony', 'Muffin', 'Oatmeal', 'Skipper',
  'Lavender', 'Cricket', 'Periwinkle', 'Jasper', 'Tumble', 'Bean', 'Loaf', 'Pudding', 'Sesame', 'Kiwi', 'Nimbus'];
export const CLANS = ['Burrowell', 'Thistledown', 'Clovercrest', 'Mossbottom', 'Fernhollow', 'Rootwhisker', 'Bramblefoot', 'Dewhop', 'Carrotley', 'Softpaw'];

export const IDLE_THOUGHTS = [
  'What a lovely tunnel.', "I wonder what's down deeper...", 'Hmm, smells like carrots.', 'La la la~',
  'My ears are extra fluffy today.', 'Is that a worm? Hi, worm!', 'Nap later? Nap later.', 'I love this warren.',
  'Dirt between my toes. Perfect.', 'Did someone say stew?', 'Thump thump!', 'Counting my whiskers again.',
];
