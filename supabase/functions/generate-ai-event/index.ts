import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type StatChanges = Record<string, number>

const allowedStats = new Set([
  'hunger',
  'mood',
  'energy',
  'health',
  'trust',
  'curiosity',
  'loneliness',
  'stress',
  'cleanliness',
])

function validateStatChanges(statChanges: StatChanges) {
  return Object.fromEntries(
    Object.entries(statChanges)
      .filter(([key, value]) => allowedStats.has(key) && typeof value === 'number')
      .map(([key, value]) => [key, Math.max(-20, Math.min(20, Math.round(value)))]),
  )
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const body = await request.json().catch(() => ({}))
  const offlineHours = Number(body.offline_hours ?? 0)
  const petName = body.pet_state?.name ?? 'your pet'

  const mockAiOutput = {
    events: [
      {
        type: 'ai_observation',
        title: 'Curious little ritual',
        description: `${petName} arranged a few room pixels into a pattern and seemed proud of it.`,
      },
    ],
    memories:
      offlineHours > 6
        ? [
            {
              type: 'room_pattern',
              title: 'A private room pattern',
              description: `${petName} remembers making the room feel more familiar.`,
              strength: 12,
              metadata: { source: 'mock_ai' },
            },
          ]
        : [],
    trait_changes: {
      curiosity: offlineHours > 2 ? 1 : 0,
    },
    stat_changes: validateStatChanges({
      mood: offlineHours > 2 ? 3 : 1,
      curiosity: 2,
    }),
  }

  return new Response(JSON.stringify(mockAiOutput), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  })
})
