export type StatKey =
  | 'hunger'
  | 'mood'
  | 'energy'
  | 'health'
  | 'trust'
  | 'curiosity'
  | 'loneliness'
  | 'stress'
  | 'cleanliness'

export type PetStats = Record<StatKey, number>

export type JsonRecord = Record<string, unknown>

export type LifeStage = 'hatchling' | 'child' | 'teen' | 'adult'

export type Pet = {
  id: string
  user_id: string
  name: string
  life_stage: LifeStage
  hunger: number
  mood: number
  energy: number
  health: number
  trust: number
  curiosity: number
  loneliness: number
  stress: number
  cleanliness: number
  personality_traits: JsonRecord
  last_simulated_at: string
  created_at: string
  updated_at: string
}

export type PetEvent = {
  id: string
  user_id: string
  pet_id: string
  type: string
  title: string
  description: string
  stat_changes: Partial<PetStats>
  source: 'user' | 'simulation' | 'ai'
  metadata: JsonRecord
  created_at: string
}

export type PetMemory = {
  id: string
  user_id: string
  pet_id: string
  type: string
  title: string
  description: string
  strength: number
  metadata: JsonRecord
  created_at: string
  updated_at: string
}

export type Environment = {
  id: string
  user_id: string
  pet_id: string
  name: string
  ambience: JsonRecord
  created_at: string
  updated_at: string
}

export type EnvironmentObject = {
  id: string
  user_id: string
  environment_id: string
  pet_id: string
  object_type: string
  name: string
  effects: Partial<PetStats>
  metadata: JsonRecord
  created_at: string
  updated_at: string
}

export type UserActionType = 'feed' | 'play' | 'clean' | 'rest' | 'talk'

export type SimulationInput = {
  pet: Pet
  elapsedHours: number
  recentEvents: PetEvent[]
  environmentObjects: EnvironmentObject[]
  memories: PetMemory[]
  now: Date
}

export type SimulationResult = {
  stats: PetStats
  events: Array<Omit<PetEvent, 'id' | 'user_id' | 'pet_id' | 'created_at'>>
  memories: Array<Omit<PetMemory, 'id' | 'user_id' | 'pet_id' | 'created_at' | 'updated_at'>>
  traitChanges: JsonRecord
  lifeStage: LifeStage
  lastSimulatedAt: string
}
