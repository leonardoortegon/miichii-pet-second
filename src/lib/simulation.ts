import type {
  EnvironmentObject,
  LifeStage,
  Pet,
  PetEvent,
  PetStats,
  SimulationInput,
  SimulationResult,
  StatKey,
  UserActionType,
} from './types'

export const statKeys: StatKey[] = [
  'hunger',
  'mood',
  'energy',
  'health',
  'trust',
  'curiosity',
  'loneliness',
  'stress',
  'cleanliness',
]

export const defaultStats: PetStats = {
  hunger: 24,
  mood: 72,
  energy: 68,
  health: 82,
  trust: 42,
  curiosity: 56,
  loneliness: 20,
  stress: 14,
  cleanliness: 76,
}

export const petStatsFromRecord = (pet: Pet): PetStats => ({
  hunger: pet.hunger,
  mood: pet.mood,
  energy: pet.energy,
  health: pet.health,
  trust: pet.trust,
  curiosity: pet.curiosity,
  loneliness: pet.loneliness,
  stress: pet.stress,
  cleanliness: pet.cleanliness,
})

export const clampStat = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export const applyStatChanges = (
  baseStats: PetStats,
  changes: Partial<PetStats>,
): PetStats =>
  statKeys.reduce(
    (nextStats, key) => ({
      ...nextStats,
      [key]: clampStat(baseStats[key] + (changes[key] ?? 0)),
    }),
    baseStats,
  )

export type EvolutionProfile = {
  lifeStage: LifeStage
  form: 'sprout' | 'bright' | 'dreamer' | 'shadow' | 'nestling'
  careScore: number
  condition: 'thriving' | 'steady' | 'tired' | 'strained'
}

const lifeStageRank: Record<LifeStage, number> = {
  hatchling: 0,
  child: 1,
  teen: 2,
  adult: 3,
}

const rankToLifeStage: LifeStage[] = ['hatchling', 'child', 'teen', 'adult']

export function resolveEvolutionProfile(
  pet: Pick<Pet, 'created_at' | 'life_stage'>,
  stats: PetStats,
  eventCount: number,
  memoryCount: number,
): EvolutionProfile {
  const ageHours = Math.max(0, (Date.now() - new Date(pet.created_at).getTime()) / 3_600_000)
  const wellness =
    stats.health * 0.25 +
    stats.mood * 0.18 +
    stats.trust * 0.18 +
    stats.curiosity * 0.12 +
    stats.energy * 0.08 +
    stats.cleanliness * 0.08 +
    (100 - stats.hunger) * 0.05 +
    (100 - stats.loneliness) * 0.03 +
    (100 - stats.stress) * 0.03
  const careScore = Math.round(wellness + eventCount * 3 + memoryCount * 6 + ageHours * 0.35)
  const nextRank =
    careScore >= 185 || eventCount >= 35 || ageHours >= 96
      ? 3
      : careScore >= 125 || eventCount >= 18 || ageHours >= 48
        ? 2
        : careScore >= 75 || eventCount >= 6 || ageHours >= 12
          ? 1
          : 0
  const lifeStage = rankToLifeStage[Math.max(lifeStageRank[pet.life_stage], nextRank)]

  const condition =
    stats.health < 35 || stats.stress > 75 || stats.hunger > 85
      ? 'strained'
      : stats.energy < 28 || stats.loneliness > 70
        ? 'tired'
        : stats.mood > 74 && stats.health > 64
          ? 'thriving'
          : 'steady'

  const form =
    condition === 'strained'
      ? 'shadow'
      : stats.trust > 72 && stats.loneliness < 36
        ? 'nestling'
        : stats.curiosity > 72
          ? 'dreamer'
          : stats.mood > 72
            ? 'bright'
            : 'sprout'

  return { lifeStage, form, careScore, condition }
}

export const actionEffects: Record<
  UserActionType,
  {
    title: string
    description: string
    changes: Partial<PetStats>
  }
> = {
  feed: {
    title: 'Snack time',
    description: 'A bowl of pixel berries vanished in record time.',
    changes: { hunger: -22, mood: 6, trust: 4, energy: 2, cleanliness: -3 },
  },
  play: {
    title: 'Tiny game session',
    description: 'The room filled with happy beeps and little hops.',
    changes: { mood: 14, energy: -12, curiosity: 7, loneliness: -10, stress: -5 },
  },
  clean: {
    title: 'Room reset',
    description: 'Dust pixels were swept away before they could unionize.',
    changes: { cleanliness: 24, health: 5, stress: -5, mood: 3 },
  },
  rest: {
    title: 'Sleep mode',
    description: 'Your pet curled up under the blanket and recharged.',
    changes: { energy: 24, stress: -8, health: 4, loneliness: 2, hunger: 6 },
  },
  talk: {
    title: 'Soft conversation',
    description: 'Your pet listened, blinked twice, and trusted you a little more.',
    changes: { trust: 10, mood: 7, loneliness: -12, curiosity: 3, stress: -4 },
  },
}

const deterministicNoise = (seed: string, range: number) => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return (Math.abs(hash) % (range * 2 + 1)) - range
}

const hasObject = (objects: EnvironmentObject[], objectType: string) =>
  objects.some((object) => object.object_type === objectType)

export function runOfflineSimulation(input: SimulationInput): SimulationResult {
  const elapsedHours = Math.min(Math.max(input.elapsedHours, 0), 168)
  const baseStats = petStatsFromRecord(input.pet)

  if (elapsedHours < 0.05) {
    return {
      stats: baseStats,
      events: [],
      memories: [],
      traitChanges: {},
      lifeStage: input.pet.life_stage,
      lastSimulatedAt: input.now.toISOString(),
    }
  }

  const blanketBonus = hasObject(input.environmentObjects, 'blanket') ? 0.9 : 1
  const ballBonus = hasObject(input.environmentObjects, 'ball') ? 0.85 : 1
  const plantBonus = hasObject(input.environmentObjects, 'plant') ? 0.9 : 1
  const bowlBonus = hasObject(input.environmentObjects, 'food_bowl') ? 0.9 : 1
  const mirrorBonus = hasObject(input.environmentObjects, 'mirror') ? 1.08 : 1
  const noise = deterministicNoise(`${input.pet.id}-${input.now.toISOString()}`, 3)

  const changes: Partial<PetStats> = {
    hunger: elapsedHours * 3.8 * bowlBonus + noise,
    energy:
      baseStats.energy < 55
        ? elapsedHours * 2.4 * blanketBonus
        : elapsedHours * -1.2 * mirrorBonus,
    loneliness: elapsedHours * 2.7 * ballBonus,
    cleanliness: elapsedHours * -2.2,
    mood: elapsedHours * -1.4 * plantBonus,
    curiosity: elapsedHours * 0.55 * mirrorBonus,
    stress: elapsedHours * 0.9 * plantBonus,
  }

  const nextStats = applyStatChanges(baseStats, changes)
  const healthPenalty =
    (nextStats.hunger > 78 ? 5 : 0) +
    (nextStats.cleanliness < 28 ? 5 : 0) +
    (nextStats.stress > 72 ? 4 : 0) +
    (nextStats.loneliness > 76 ? 4 : 0)

  const stats = applyStatChanges(nextStats, { health: -healthPenalty })
  const roundedHours = Math.max(1, Math.round(elapsedHours))
  const events: SimulationResult['events'] = [
    {
      type: 'offline_simulation',
      title: `${roundedHours} offline hour${roundedHours === 1 ? '' : 's'} passed`,
      description:
        elapsedHours > 8
          ? `${input.pet.name} kept busy while you were away, but the little room needs attention.`
          : `${input.pet.name} drifted through a quiet little cycle of waiting, wandering, and blinking.`,
      stat_changes: statKeys.reduce<Partial<PetStats>>((summary, key) => {
        const delta = stats[key] - baseStats[key]
        return delta === 0 ? summary : { ...summary, [key]: delta }
      }, {}),
      source: 'simulation',
      metadata: { elapsed_hours: Number(elapsedHours.toFixed(2)), capped: input.elapsedHours > 168 },
    },
  ]

  const memories: SimulationResult['memories'] = []
  const recentFeeds = input.recentEvents.filter((event) => event.type === 'feed').length

  if (
    recentFeeds >= 3 &&
    !input.memories.some((memory) => memory.type === 'food_preference')
  ) {
    memories.push({
      type: 'food_preference',
      title: 'Berry preference',
      description: `${input.pet.name} remembers berry snacks as comfort food.`,
      strength: 35,
      metadata: { trigger: 'repeated_feed', flavor: 'pixel berries' },
    })
  }

  if (
    elapsedHours >= 12 &&
    stats.loneliness > 65 &&
    !input.memories.some((memory) => memory.type === 'long_wait')
  ) {
    memories.push({
      type: 'long_wait',
      title: 'Long quiet stretch',
      description: `${input.pet.name} remembers watching the door for a while.`,
      strength: 20,
      metadata: { trigger: 'offline_loneliness', elapsed_hours: Number(elapsedHours.toFixed(2)) },
    })
  }

  const evolution = resolveEvolutionProfile(
    input.pet,
    stats,
    input.recentEvents.length + events.length,
    input.memories.length + memories.length,
  )

  if (evolution.lifeStage !== input.pet.life_stage) {
    events.push({
      type: 'evolution',
      title: `${input.pet.name} grew into ${evolution.lifeStage}`,
      description: `${input.pet.name}'s pixel shape shifted after many small remembered moments.`,
      stat_changes: {},
      source: 'simulation',
      metadata: {
        from_stage: input.pet.life_stage,
        to_stage: evolution.lifeStage,
        form: evolution.form,
        care_score: evolution.careScore,
        condition: evolution.condition,
      },
    })
  }

  return {
    stats,
    events,
    memories,
    traitChanges: {
      patience: elapsedHours > 12 ? 1 : 0,
      nest_focus: hasObject(input.environmentObjects, 'blanket') ? 1 : 0,
      evolution_form: evolution.form,
      condition: evolution.condition,
      care_score: evolution.careScore,
    },
    lifeStage: evolution.lifeStage,
    lastSimulatedAt: input.now.toISOString(),
  }
}

export function validateAiPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return { events: [], memories: [], trait_changes: {}, stat_changes: {} }
  }

  const candidate = payload as Record<string, unknown>
  const statChanges = candidate.stat_changes as Partial<PetStats> | undefined
  const safeStatChanges = statKeys.reduce<Partial<PetStats>>((changes, key) => {
    const value = statChanges?.[key]
    if (typeof value !== 'number') {
      return changes
    }

    return { ...changes, [key]: Math.max(-20, Math.min(20, Math.round(value))) }
  }, {})

  const events = Array.isArray(candidate.events)
    ? candidate.events.slice(0, 3).filter((event): event is Pick<PetEvent, 'type' | 'title' | 'description'> => {
        const item = event as Record<string, unknown>
        return (
          typeof item.type === 'string' &&
          typeof item.title === 'string' &&
          typeof item.description === 'string'
        )
      })
    : []

  return {
    events,
    memories: Array.isArray(candidate.memories) ? candidate.memories.slice(0, 2) : [],
    trait_changes: typeof candidate.trait_changes === 'object' ? candidate.trait_changes : {},
    stat_changes: safeStatChanges,
  }
}
