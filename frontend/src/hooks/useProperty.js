import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

// Hook to manage the currently selected property across the app
// The selected property is persisted in localStorage so it survives page refreshes
export function useProperty() {
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['my-properties'],
    queryFn: () => api.get('/api/properties'),
    staleTime: 60_000,
  })

  const [selectedId, setSelectedId] = useState(() => {
    return localStorage.getItem('selected_property') || ''
  })

  // Auto-select the first property if none is selected yet
  useEffect(() => {
    if (properties.length > 0 && !selectedId) {
      const first = properties[0].id
      setSelectedId(first)
      localStorage.setItem('selected_property', first)
    }
  }, [properties, selectedId])

  const select = (id) => {
    setSelectedId(id)
    localStorage.setItem('selected_property', id)
  }

  const selectedProperty = properties.find(p => p.id === selectedId)

  return { properties, selectedId, selectedProperty, select, isLoading }
}
