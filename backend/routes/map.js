import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/map/:property_id
// Returns full building structure: floors > rooms > beds with tenant info for the visual map
r.get('/:property_id', asyncHandler(async (req, res) => {
  const { property_id } = req.params
  const { filter } = req.query // 'all' | 'vacant' | 'occupied' | 'notice_period' | 'maintenance'

  // Fetch all floors for this property, ordered by floor number
  const { data: floors, error: flErr } = await db.from('floors')
    .select('id, floor_number, floor_label')
    .eq('property_id', property_id)
    .order('floor_number')

  if (flErr) return res.status(400).json({ error: flErr.message })
  if (!floors?.length) return res.json({ floors: [] })

  // Fetch all rooms for this property
  const { data: rooms } = await db.from('rooms')
    .select('id, floor_id, room_number, room_type, base_rent, is_active')
    .eq('property_id', property_id)
    .eq('is_active', true)
    .order('room_number')

  // Fetch all beds with tenant info joined through active tenancy
  const { data: beds } = await db.from('beds')
    .select(`
      id, room_id, bed_number, status,
      tenancies!left (
        id, is_active, notice_given_date, check_in_date, rent_amount,
        tenant:users!tenant_id ( id, full_name, phone, profile_photo_url )
      )
    `)
    .eq('property_id', property_id)
    .order('bed_number')

  // Map beds to rooms and apply the status filter if provided
  const floorMap = floors.map(floor => {
    const floorRooms = (rooms || []).filter(r => r.floor_id === floor.id).map(room => {
      let roomBeds = (beds || []).filter(b => b.room_id === room.id).map(bed => {
        // Find the active tenancy for this bed
        const activeTenancy = bed.tenancies?.find(t => t.is_active)
        return {
          id:           bed.id,
          bed_number:   bed.bed_number,
          status:       bed.status,
          tenant:       activeTenancy?.tenant || null,
          tenancy_id:   activeTenancy?.id || null,
          check_in:     activeTenancy?.check_in_date || null,
          rent_amount:  activeTenancy?.rent_amount || null,
          notice_given: activeTenancy?.notice_given_date || null,
        }
      })

      // Apply filter: only return beds matching the requested status
      if (filter && filter !== 'all') {
        roomBeds = roomBeds.filter(b => b.status === filter)
      }

      return {
        id:         room.id,
        room_number: room.room_number,
        room_type:  room.room_type,
        base_rent:  room.base_rent,
        beds:       roomBeds,
        // Summary counts for this room
        total_beds:    roomBeds.length,
        occupied_beds: roomBeds.filter(b => b.status === 'occupied').length,
        vacant_beds:   roomBeds.filter(b => b.status === 'vacant').length,
      }
    })

    // When filtering, skip rooms that have no matching beds
    if (filter && filter !== 'all') {
      floorRooms = floorRooms.filter(r => r.beds.length > 0)
    }

    return {
      id:           floor.id,
      floor_number: floor.floor_number,
      floor_label:  floor.floor_label,
      rooms:        floorRooms,
    }
  })

  // Summary stats for the whole building
  const allBeds = beds || []
  const summary = {
    total:         allBeds.length,
    occupied:      allBeds.filter(b => b.status === 'occupied').length,
    vacant:        allBeds.filter(b => b.status === 'vacant').length,
    notice_period: allBeds.filter(b => b.status === 'notice_period').length,
    maintenance:   allBeds.filter(b => b.status === 'maintenance').length,
    reserved:      allBeds.filter(b => b.status === 'reserved').length,
  }

  res.json({ floors: floorMap, summary })
}))

export default r
