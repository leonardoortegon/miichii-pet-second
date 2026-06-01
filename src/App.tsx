import { useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import {
  Bath,
  Bed,
  Gamepad2,
  LogOut,
  MessageCircle,
  Plus,
  Sparkles,
  Utensils,
} from 'lucide-react'
import './App.css'
import { actionEffects, applyStatChanges, defaultStats, petStatsFromRecord, runOfflineSimulation, statKeys } from './lib/simulation'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Environment, EnvironmentObject, Pet, PetEvent, PetMemory, PetStats, UserActionType } from './lib/types'
import { useGameStore } from './stores/gameStore'

const queryClient = new QueryClient()

const actionIcons: Record<UserActionType, typeof Utensils> = {
  feed: Utensils,
  play: Gamepad2,
  clean: Bath,
  rest: Bed,
  talk: MessageCircle,
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MiichiiApp />
    </QueryClientProvider>
  )
}

function MiichiiApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  if (loadingSession) {
    return <div className="boot-screen">Booting pocket core...</div>
  }

  return session ? <GameShell session={session} /> : <AuthScreen />
}

function SetupNotice() {
  return (
    <main className="auth-page">
      <section className="device auth-device">
        <div className="brand-row">
          <span>MIICHII</span>
          <span>SUPABASE LINK</span>
        </div>
        <div className="lcd setup-panel">
          <h1>Connect Supabase</h1>
          <p>Create a `.env.local` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run the SQL in `supabase/migrations`.</p>
        </div>
      </section>
    </main>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    const authCall =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await authCall

    setBusy(false)
    setMessage(error ? error.message : mode === 'login' ? 'Welcome back.' : 'Check your inbox if email confirmation is enabled.')
  }

  return (
    <main className="auth-page">
      <section className="device auth-device">
        <div className="brand-row">
          <span>MIICHII</span>
          <span>V-PET 1997</span>
        </div>
        <div className="lcd auth-lcd">
          <div className="pet-sprite idle" aria-hidden="true">
            <span className="eye left-eye" />
            <span className="eye right-eye" />
            <span className="mouth" />
          </div>
          <h1>{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} required />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? '...' : mode === 'login' ? 'Enter' : 'Create'}
            </button>
          </form>
          <button className="link-button" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Need an egg?' : 'Already hatched?'}
          </button>
          {message && <p className="system-message">{message}</p>}
        </div>
      </section>
    </main>
  )
}

function GameShell({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const selectedPetId = useGameStore((store) => store.selectedPetId)
  const setSelectedPetId = useGameStore((store) => store.setSelectedPetId)
  const simulatedPetIds = useRef<Set<string>>(new Set())

  const petsQuery = useQuery({
    queryKey: ['pets', session.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Pet[]
    },
  })

  useEffect(() => {
    const firstPet = petsQuery.data?.[0]
    if (!selectedPetId && firstPet) {
      setSelectedPetId(firstPet.id)
    }
  }, [petsQuery.data, selectedPetId, setSelectedPetId])

  const pet = petsQuery.data?.find((candidate) => candidate.id === selectedPetId) ?? petsQuery.data?.[0] ?? null

  const eventsQuery = useQuery({
    queryKey: ['pet-events', pet?.id],
    enabled: Boolean(pet),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pet_events')
        .select('*')
        .eq('pet_id', pet!.id)
        .order('created_at', { ascending: false })
        .limit(40)

      if (error) throw error
      return (data ?? []) as PetEvent[]
    },
  })

  const memoriesQuery = useQuery({
    queryKey: ['pet-memories', pet?.id],
    enabled: Boolean(pet),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pet_memories')
        .select('*')
        .eq('pet_id', pet!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as PetMemory[]
    },
  })

  const environmentQuery = useQuery({
    queryKey: ['pet-environment', pet?.id],
    enabled: Boolean(pet),
    queryFn: async () => {
      const { data: environment, error: environmentError } = await supabase
        .from('environments')
        .select('*')
        .eq('pet_id', pet!.id)
        .single()

      if (environmentError) throw environmentError

      const { data: objects, error: objectsError } = await supabase
        .from('environment_objects')
        .select('*')
        .eq('pet_id', pet!.id)
        .order('created_at', { ascending: true })

      if (objectsError) throw objectsError
      return { environment: environment as Environment, objects: (objects ?? []) as EnvironmentObject[] }
    },
  })

  const createPetMutation = useMutation({
    mutationFn: async (name: string) => createPet(session.user.id, name),
    onSuccess: (newPet) => {
      setSelectedPetId(newPet.id)
      queryClient.invalidateQueries({ queryKey: ['pets', session.user.id] })
    },
  })

  const actionMutation = useMutation({
    mutationFn: async (action: UserActionType) => {
      if (!pet) throw new Error('Choose a pet first.')
      return performUserAction(session.user.id, pet, action, eventsQuery.data ?? [])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets', session.user.id] })
      queryClient.invalidateQueries({ queryKey: ['pet-events', pet?.id] })
      queryClient.invalidateQueries({ queryKey: ['pet-memories', pet?.id] })
    },
  })

  const simulationMutation = useMutation({
    mutationFn: async () => {
      if (!pet || !environmentQuery.data) throw new Error('Missing simulation input.')
      const now = new Date()
      const elapsedHours = (now.getTime() - new Date(pet.last_simulated_at).getTime()) / 3_600_000
      const result = runOfflineSimulation({
        pet,
        elapsedHours,
        recentEvents: eventsQuery.data ?? [],
        memories: memoriesQuery.data ?? [],
        environmentObjects: environmentQuery.data.objects,
        now,
      })

      await applySimulationResult(session.user.id, pet, elapsedHours, result)
    },
    onSuccess: () => {
      if (pet) {
        simulatedPetIds.current.add(pet.id)
      }
      queryClient.invalidateQueries({ queryKey: ['pets', session.user.id] })
      queryClient.invalidateQueries({ queryKey: ['pet-events', pet?.id] })
      queryClient.invalidateQueries({ queryKey: ['pet-memories', pet?.id] })
    },
  })

  useEffect(() => {
    if (!pet || !environmentQuery.data || simulatedPetIds.current.has(pet.id) || simulationMutation.isPending) {
      return
    }

    const elapsedMinutes = (Date.now() - new Date(pet.last_simulated_at).getTime()) / 60_000
    if (elapsedMinutes >= 3) {
      simulationMutation.mutate()
    } else {
      simulatedPetIds.current.add(pet.id)
    }
  }, [environmentQuery.data, pet, simulationMutation])

  const stats = useMemo(() => (pet ? petStatsFromRecord(pet) : defaultStats), [pet])

  return (
    <main className="game-page">
      <section className="device">
        <div className="brand-row">
          <span>MIICHII</span>
          <button className="icon-text" type="button" onClick={() => supabase.auth.signOut()}>
            <LogOut size={14} />
            Out
          </button>
        </div>

        {!pet ? (
          <CreatePetPanel isPending={createPetMutation.isPending} onCreate={(name) => createPetMutation.mutate(name)} />
        ) : (
          <div className="game-grid">
            <section className="lcd main-screen">
              <PetSelector pets={petsQuery.data ?? []} selectedPetId={pet.id} onSelect={setSelectedPetId} />
              <div className="room">
                <RoomObjectStrip objects={environmentQuery.data?.objects ?? []} />
                <div className={`pet-sprite ${stats.mood > 66 ? 'happy' : stats.energy < 28 ? 'sleepy' : 'idle'}`} aria-label={`${pet.name} pixel pet`}>
                  <span className="eye left-eye" />
                  <span className="eye right-eye" />
                  <span className="mouth" />
                </div>
                <div className="pet-shadow" />
              </div>
              <div className="pet-readout">
                <h1>{pet.name}</h1>
                <span>{pet.life_stage}</span>
              </div>
              <StatsGrid stats={stats} />
              <ActionPad busy={actionMutation.isPending} onAction={(action) => actionMutation.mutate(action)} />
            </section>

            <aside className="side-panels">
              <Panel title="Timeline">
                <EventTimeline events={eventsQuery.data ?? []} />
              </Panel>
              <Panel title="Memories">
                <MemoryList memories={memoriesQuery.data ?? []} />
              </Panel>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}

function CreatePetPanel({ isPending, onCreate }: { isPending: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')

  return (
    <div className="lcd create-panel">
      <Sparkles size={28} />
      <h1>Name your pet</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) {
            onCreate(name.trim())
          }
        }}
      >
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Michi" />
        <button type="submit" disabled={isPending}>
          <Plus size={16} />
          Hatch
        </button>
      </form>
    </div>
  )
}

function PetSelector({ pets, selectedPetId, onSelect }: { pets: Pet[]; selectedPetId: string; onSelect: (id: string) => void }) {
  return (
    <div className="pet-tabs">
      {pets.map((pet) => (
        <button className={pet.id === selectedPetId ? 'active' : ''} key={pet.id} type="button" onClick={() => onSelect(pet.id)}>
          {pet.name}
        </button>
      ))}
    </div>
  )
}

function StatsGrid({ stats }: { stats: PetStats }) {
  return (
    <div className="stats-grid">
      {statKeys.map((key) => (
        <div className="stat-row" key={key}>
          <span>{key}</span>
          <div className="meter">
            <i style={{ width: `${stats[key]}%` }} />
          </div>
          <b>{stats[key]}</b>
        </div>
      ))}
    </div>
  )
}

function ActionPad({ busy, onAction }: { busy: boolean; onAction: (action: UserActionType) => void }) {
  return (
    <div className="action-pad">
      {(Object.keys(actionEffects) as UserActionType[]).map((action) => {
        const Icon = actionIcons[action]
        return (
          <button key={action} type="button" disabled={busy} onClick={() => onAction(action)} title={actionEffects[action].description}>
            <Icon size={18} />
            {action}
          </button>
        )
      })}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function EventTimeline({ events }: { events: PetEvent[] }) {
  if (!events.length) {
    return <p className="empty">No events yet.</p>
  }

  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <time>{new Date(event.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          <strong>{event.title}</strong>
          <p>{event.description}</p>
          <small>{event.source}</small>
        </li>
      ))}
    </ol>
  )
}

function MemoryList({ memories }: { memories: PetMemory[] }) {
  if (!memories.length) {
    return <p className="empty">No memories formed yet.</p>
  }

  return (
    <ul className="memory-list">
      {memories.map((memory) => (
        <li key={memory.id}>
          <strong>{memory.title}</strong>
          <p>{memory.description}</p>
          <span>strength {memory.strength}</span>
        </li>
      ))}
    </ul>
  )
}

function RoomObjectStrip({ objects }: { objects: EnvironmentObject[] }) {
  const glyphs: Record<string, string> = {
    blanket: '▰',
    ball: '●',
    mirror: '◧',
    plant: '♣',
    food_bowl: '▔',
  }

  return (
    <div className="object-strip" aria-label="room objects">
      {objects.map((object) => (
        <span key={object.id} title={object.name}>
          {glyphs[object.object_type] ?? '□'}
        </span>
      ))}
    </div>
  )
}

async function createPet(userId: string, name: string) {
  const { data: pet, error: petError } = await supabase
    .from('pets')
    .insert({ user_id: userId, name })
    .select('*')
    .single()

  if (petError) throw petError

  const typedPet = pet as Pet
  const { data: environment, error: environmentError } = await supabase
    .from('environments')
    .insert({ user_id: userId, pet_id: typedPet.id, name: `${name}'s room` })
    .select('*')
    .single()

  if (environmentError) throw environmentError

  const typedEnvironment = environment as Environment
  const starterObjects = [
    ['blanket', 'Checkered blanket', { energy: 3 }],
    ['ball', 'Tiny ball', { mood: 2, loneliness: -2 }],
    ['mirror', 'Little mirror', { curiosity: 2 }],
    ['plant', 'Desk plant', { stress: -2 }],
    ['food_bowl', 'Food bowl', { hunger: -1 }],
  ] as const

  const { error: objectError } = await supabase.from('environment_objects').insert(
    starterObjects.map(([objectType, objectName, effects]) => ({
      user_id: userId,
      pet_id: typedPet.id,
      environment_id: typedEnvironment.id,
      object_type: objectType,
      name: objectName,
      effects,
    })),
  )

  if (objectError) throw objectError

  const { error: eventError } = await supabase.from('pet_events').insert({
    user_id: userId,
    pet_id: typedPet.id,
    type: 'created',
    title: 'A new little signal',
    description: `${name} blinked awake inside the pocket room.`,
    stat_changes: {},
    source: 'simulation',
    metadata: { starter: true },
  })

  if (eventError) throw eventError
  return typedPet
}

async function performUserAction(userId: string, pet: Pet, action: UserActionType, recentEvents: PetEvent[]) {
  const effect = actionEffects[action]
  const nextStats = applyStatChanges(petStatsFromRecord(pet), effect.changes)

  const { error: updateError } = await supabase
    .from('pets')
    .update({ ...nextStats, last_simulated_at: new Date().toISOString() })
    .eq('id', pet.id)
    .eq('user_id', userId)

  if (updateError) throw updateError

  const { error: actionError } = await supabase.from('user_actions').insert({
    user_id: userId,
    pet_id: pet.id,
    action_type: action,
    payload: { stat_changes: effect.changes },
  })

  if (actionError) throw actionError

  const { error: eventError } = await supabase.from('pet_events').insert({
    user_id: userId,
    pet_id: pet.id,
    type: action,
    title: effect.title,
    description: effect.description,
    stat_changes: effect.changes,
    source: 'user',
    metadata: { action },
  })

  if (eventError) throw eventError

  const recentFeedCount = recentEvents.filter((event) => event.type === 'feed').length
  if (action === 'feed' && recentFeedCount >= 2) {
    await supabase.from('pet_memories').upsert(
      {
        user_id: userId,
        pet_id: pet.id,
        type: 'food_preference',
        title: 'Berry preference',
        description: `${pet.name} lights up when pixel berries appear.`,
        strength: Math.min(100, 35 + recentFeedCount * 5),
        metadata: { trigger: 'repeated_feed', flavor: 'pixel berries' },
      },
      { onConflict: 'pet_id,type' },
    )
  }
}

async function applySimulationResult(
  userId: string,
  pet: Pet,
  elapsedHours: number,
  result: ReturnType<typeof runOfflineSimulation>,
) {
  const nextTraits = { ...pet.personality_traits, ...result.traitChanges }
  const { error: updateError } = await supabase
    .from('pets')
    .update({ ...result.stats, personality_traits: nextTraits, last_simulated_at: result.lastSimulatedAt })
    .eq('id', pet.id)
    .eq('user_id', userId)

  if (updateError) throw updateError

  if (result.events.length) {
    const { error } = await supabase.from('pet_events').insert(
      result.events.map((event) => ({
        ...event,
        user_id: userId,
        pet_id: pet.id,
      })),
    )
    if (error) throw error
  }

  if (result.memories.length) {
    const { error } = await supabase.from('pet_memories').upsert(
      result.memories.map((memory) => ({
        ...memory,
        user_id: userId,
        pet_id: pet.id,
      })),
      { onConflict: 'pet_id,type' },
    )
    if (error) throw error
  }

  const { error: runError } = await supabase.from('simulation_runs').insert({
    user_id: userId,
    pet_id: pet.id,
    elapsed_hours: Number(elapsedHours.toFixed(3)),
    input_snapshot: { last_simulated_at: pet.last_simulated_at },
    output_snapshot: result,
  })

  if (runError) throw runError
}

export default App
