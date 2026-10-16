/**
 * Content for the evacuation experience. Copy targets about a 7th–8th grade
 * reading level. Items marked "placeholder" need review by the client
 * (community shelter and assisted-evacuation details are still coming).
 */
export type ItemId =
  | "pet" | "id" | "food" | "phone" | "radio" | "clothing" | "medicine"
  | "flashlight" | "firstAid" | "medical"
  | "photos" | "jewelry" | "heirloom"
  | "gum" | "hat" | "trophy";

export type Choice = "shelter" | "evacuate";
export type DestinationId = "family" | "hotel" | "public" | "solar";
export type TimingId = "early" | "wait";

export type Item = {
  label: string;
  icon: string;
  /** 1 = pets, ID, food, communication; 2 = sentimental; 3 = frivolous. Never shown to players. */
  tier: 1 | 2 | 3;
};

export type Round = {
  prompt: string;
  /** Exactly this many items must be removed to continue. */
  remove: number;
  /** Items the Help Agent stops warning about this round (no longer vital). */
  skipAdvice?: ItemId[];
};

export type Kit = {
  /** What starts in the duffel. */
  duffel: ItemId[];
  /** What the final bag should still hold. */
  core: ItemId[];
  rounds: Round[];
  /** Help Agent message when a player tries to remove an item. */
  advice: Partial<Record<ItemId, string>>;
  /** Friendly "good to know" shown on the results screen if a core item was removed. */
  tips: Partial<Record<ItemId, string>>;
};

export type Scenario = {
  id: string;
  title: string;
  conditions: { flooding: string; wind: string; power: string; track: string };
  /** Official message from local leaders. */
  official: string;
  household: string;
  recommended: Choice;
  /** Why the recommendation makes sense, in plain words. */
  why: string;
  /** Added to the duffel (and counted as vital) for this household. */
  extraItems?: ItemId[];
  goodDestinations: DestinationId[];
  destinationTip: string;
};

const items: Record<ItemId, Item> = {
  pet: { label: "Pet", icon: "🐕", tier: 1 },
  id: { label: "ID & Documents", icon: "🪪", tier: 1 },
  food: { label: "Food & Water", icon: "🥫", tier: 1 },
  phone: { label: "Phone & Charger", icon: "📱", tier: 1 },
  radio: { label: "Radio & Batteries", icon: "📻", tier: 1 },
  clothing: { label: "Extra Clothing", icon: "👕", tier: 1 },
  medicine: { label: "Medications", icon: "💊", tier: 1 },
  flashlight: { label: "Flashlight", icon: "🔦", tier: 1 },
  firstAid: { label: "First-Aid Kit", icon: "🩹", tier: 1 },
  medical: { label: "Medical Equipment", icon: "🩺", tier: 1 },
  photos: { label: "Photo Album", icon: "📷", tier: 2 },
  jewelry: { label: "Jewelry", icon: "💍", tier: 2 },
  heirloom: { label: "Family Heirloom", icon: "🏺", tier: 2 },
  gum: { label: "Chewing Gum", icon: "🍬", tier: 3 },
  hat: { label: "Favorite Hat", icon: "🎩", tier: 3 },
  trophy: { label: "Bowling Trophy", icon: "🏆", tier: 3 },
};

const scenarios: Scenario[] = [
  {
    id: "tropical",
    title: "A Tropical Storm",
    conditions: {
      flooding: "Some street flooding possible",
      wind: "Gusts up to 50 mph",
      power: "Short outages possible",
      track: "Passing west of the city",
    },
    official:
      "Local officials: There is no evacuation order. Stay informed and be ready to stay home.",
    household: "Your home is sturdy and outside the flood zone.",
    recommended: "shelter",
    why: "The storm is weak and passing to the west, so staying home with a kit is safe.",
    goodDestinations: [],
    destinationTip: "",
  },
  {
    id: "major",
    title: "A Strong Hurricane",
    conditions: {
      flooding: "Dangerous storm surge",
      wind: "Winds over 130 mph",
      power: "Long outages likely",
      track: "Heading straight for the city",
    },
    official:
      "Local officials: Evacuation is ordered for your area. Leave as soon as you can.",
    household: "Your family has one car and a pet dog.",
    recommended: "evacuate",
    why: "Storm surge and wind this strong can destroy homes, and help can't reach you during the storm.",
    goodDestinations: ["family", "hotel", "public"],
    destinationTip: "Family or friends outside the area, a hotel, or a public shelter all work well.",
  },
  {
    id: "power",
    title: "A Hurricane and a Power Problem",
    conditions: {
      flooding: "Flooding in low areas",
      wind: "Winds up to 100 mph",
      power: "Power may be out for days",
      track: "Passing just east of the city",
    },
    official:
      "Local officials: Evacuation is recommended. People who need electricity for medical equipment should leave early.",
    household:
      "A family member uses a breathing machine that needs electricity. You do not have a car.",
    recommended: "evacuate",
    why: "Without power for days, the breathing machine can't run safely at home.",
    // placeholder: confirm what free evacuation rides and shelters exist
    extraItems: ["medical"],
    goodDestinations: ["solar", "public"],
    destinationTip:
      "A community solar-powered shelter keeps the electricity on. Ask local officials about free rides if you don't have a car.",
  },
];

const destinations: Record<DestinationId, { label: string; icon: string; note: string; praise: string }> = {
  family: {
    label: "Family or friends outside the area",
    icon: "🏡",
    note: "You need a car or a ride.",
    praise: "Staying with people you know is a great plan.",
  },
  hotel: {
    label: "A hotel outside the area",
    icon: "🏨",
    note: "You need a car and money for the stay.",
    praise: "A hotel outside the storm's path can be comfortable and safe.",
  },
  public: {
    label: "A public shelter",
    icon: "🏫",
    note: "Free and open to everyone. Bring your own supplies.",
    praise: "Public shelters are free and open to everyone, so this is a smart plan.",
  },
  solar: {
    label: "A community solar-powered shelter",
    icon: "☀️",
    note: "Has electricity for medical equipment and phones.",
    praise: "A solar-powered shelter keeps the power on, which helps a lot with medical needs.",
  },
};

const timings: Record<TimingId, { label: string; icon: string; note: string; praise: string }> = {
  early: {
    label: "Leave as soon as the order is given",
    icon: "🕐",
    note: "Roads are clearer and you have more choices.",
    praise: "Smart. Leaving early means open roads and more choices.",
  },
  wait: {
    label: "Wait until the storm is closer",
    icon: "⏳",
    note: "Roads fill up and bridges can close.",
    praise:
      "Many people wait, but roads fill up and bridges can close. Leaving early gives you more choices.",
  },
};

const kits: Record<Choice, Kit> = {
  evacuate: {
    duffel: [
      "pet", "id", "food", "phone", "radio", "clothing", "medicine",
      "flashlight", "photos", "jewelry", "heirloom", "gum", "hat", "trophy",
    ],
    core: ["pet", "id", "food", "phone", "clothing", "medicine"],
    rounds: [
      {
        prompt:
          "You made it to a safe place, and everyone is okay. There isn't much room for bags. Choose three items you no longer need.",
        remove: 3,
      },
      {
        prompt:
          "You can get news and updates here. Choose two more items to take out.",
        remove: 2,
        skipAdvice: ["radio"],
      },
      {
        prompt:
          "The lights are on and everything is calm. Choose the last two items to take out.",
        remove: 2,
        skipAdvice: ["radio", "flashlight"],
      },
    ],
    advice: {
      pet: "Your pet needs you, and many shelters only take pets that come with you. I'd keep them close.",
      id: "You need ID to sign in to a shelter and to get help later. I'd keep it.",
      food: "Supplies can run low if you stay a while. Your own food and water is a smart thing to keep.",
      phone: "Your phone is how family finds you and how you get updates. Think about keeping it.",
      clothing: "Laundry may not be available where you are. Extra clothes are worth keeping.",
      medicine: "Pharmacies may be closed for days, so you can't easily replace medications.",
      medical: "This equipment keeps your family member healthy. Keep it with you.",
      radio: "You haven't got news yet. A radio is a reliable way to hear what officials say.",
      flashlight: "The power could still go out tonight. A flashlight is cheap insurance.",
    },
    tips: {
      pet: "Pets need to come with you, so plan for them early.",
      id: "Keep ID and papers in a waterproof bag.",
      food: "Pack at least three days of food and water.",
      phone: "Keep a charger or battery pack in your kit.",
      clothing: "Pack a few days of clothes, since laundry may not be open.",
      medicine: "Keep a week of medications packed.",
      medical: "Plan for backup power for medical equipment.",
    },
  },
  shelter: {
    duffel: [
      "pet", "id", "food", "phone", "radio", "clothing", "medicine",
      "flashlight", "firstAid", "photos", "jewelry", "heirloom", "gum", "trophy",
    ],
    core: ["pet", "id", "food", "radio", "flashlight", "firstAid", "medicine"],
    rounds: [
      {
        prompt:
          "The wind is picking up and you're moving to your safest room. You can only keep what you can carry. Choose three items to take out.",
        remove: 3,
      },
      {
        prompt:
          "Cell service is down in your neighborhood. Choose two more items to take out.",
        remove: 2,
        skipAdvice: ["phone"],
      },
      {
        prompt:
          "The storm has passed and you're waiting for the all-clear. Choose the last two items to take out.",
        remove: 2,
        skipAdvice: ["phone", "clothing"],
      },
    ],
    advice: {
      pet: "Your pet is part of the family and shouldn't weather this alone. I'd keep them with you.",
      id: "You may need ID for help after the storm. Think about keeping it.",
      food: "You could be waiting a few days. Food and clean water are a lifeline.",
      phone: "Your phone may still help until service drops. Are you sure?",
      radio: "With power and cell service out, a battery radio is how you hear instructions.",
      flashlight: "It will be very dark when the power goes. Keep your flashlight.",
      firstAid: "Help may be hours away. A first-aid kit could be vital.",
      medicine: "You can't refill medications until things reopen. I'd keep them.",
      medical: "This equipment keeps your family member healthy. Keep it with you.",
    },
    tips: {
      pet: "Keep pet supplies in your kit.",
      id: "Keep ID and papers in a waterproof bag.",
      food: "Pack at least three days of food and water.",
      radio: "A battery or hand-crank radio works when the power and phones don't.",
      flashlight: "Keep a flashlight and extra batteries ready.",
      firstAid: "A first-aid kit helps with small injuries until help arrives.",
      medicine: "Keep a week of medications packed.",
      medical: "Plan for backup power for medical equipment.",
    },
  },
};

const evacuation = {
  idleTimeoutMs: 60_000,
  /** Shown on the opening and result screens. */
  planAheadNote:
    "Make your plan before hurricane season starts on June 1.",
  items,
  scenarios,
  destinations,
  timings,
  kits,

  /** Every result is positive; this only changes how much we celebrate. */
  outcomes: [
    { maxMissing: 0, title: "You're prepared!", text: "You kept everything that matters most." },
    { maxMissing: 2, title: "You're ready to go!", text: "You have what you need. A few tips for next time are below." },
    { maxMissing: Infinity, title: "Great start!", text: "You made it safely. Here is what to remember when you pack your own kit." },
  ],

  takeaways: [
    "Be prepared. Make a plan and pack a kit before hurricane season starts on June 1.",
    "Gather information. Listen to local officials, the National Weather Service and a battery or hand-crank radio.",
    "Make a smart decision. Not every storm means leaving, so look at the facts for your area.",
    "Stay safe. Keep far away from downed power lines and flood water.",
  ],
};

export function outcomeFor(missing: number) {
  return (
    evacuation.outcomes.find((o) => missing <= o.maxMissing) ??
    evacuation.outcomes[evacuation.outcomes.length - 1]
  );
}

export const choiceLabel = (c: Choice) => (c === "shelter" ? "Shelter in place" : "Evacuate");

export default evacuation;
