import { create } from 'zustand'

type GameStore = {
  selectedPetId: string | null
  setSelectedPetId: (petId: string | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  selectedPetId: null,
  setSelectedPetId: (selectedPetId) => set({ selectedPetId }),
}))
