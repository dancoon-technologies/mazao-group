/**
 * Tests for row-to-API mappers (offline list/detail).
 */

import {
  farmerRowToFarmer,
  farmRowToFarm,
  scheduleRowToSchedule,
  visitRowToVisit,
} from '@/lib/offline-helpers';

describe('farmerRowToFarmer', () => {
  it('maps full row to Farmer', () => {
    const row = {
      id: 'f1',
      first_name: 'Jane',
      middle_name: 'M',
      last_name: 'Doe',
      display_name: 'Jane Doe',
      phone: '+255111',
      latitude: '-6.1',
      longitude: '39.2',
      created_at: 1700000000000,
    };
    const out = farmerRowToFarmer(row as any);
    expect(out.id).toBe('f1');
    expect(out.first_name).toBe('Jane');
    expect(out.middle_name).toBe('M');
    expect(out.last_name).toBe('Doe');
    expect(out.display_name).toBe('Jane Doe');
    expect(out.phone).toBe('+255111');
    expect(out.created_at).toBe(new Date(1700000000000).toISOString());
  });

  it('builds display_name from first_name and last_name when display_name null', () => {
    const row = {
      id: 'f2',
      first_name: 'John',
      middle_name: null,
      last_name: 'Doe',
      display_name: null,
      phone: null,
      latitude: null,
      longitude: null,
      created_at: 0,
    };
    const out = farmerRowToFarmer(row as any);
    expect(out.display_name).toBe('John Doe');
  });
});

describe('farmRowToFarm', () => {
  it('maps full row to Farm', () => {
    const row = {
      id: 'farm1',
      farmer_id: 'f1',
      region_id: 1,
      region: 'North',
      county_id: 2,
      county: 'County',
      sub_county_id: 3,
      sub_county: 'Sub',
      village: 'Village A',
      latitude: -6.1,
      longitude: 39.2,
      plot_size: '1 ha',
      crop_type: 'Maize',
      created_at: 1700000000000,
    };
    const out = farmRowToFarm(row as any);
    expect(out.id).toBe('farm1');
    expect(out.farmer).toBe('f1');
    expect(out.region_id).toBe(1);
    expect(out.village).toBe('Village A');
    expect(out.latitude).toBe(-6.1);
    expect(out.longitude).toBe(39.2);
    expect(out.created_at).toBe(new Date(1700000000000).toISOString());
  });
});

describe('scheduleRowToSchedule', () => {
  it('maps row to Schedule with YYYY-MM-DD date', () => {
    const row = {
      id: 's1',
      officer: 'o1',
      farmer: 'f1',
      farmer_display_name: 'Jane Doe',
      farm: 'farm1',
      farm_display_name: 'Plot A',
      scheduled_date: new Date('2025-06-01').getTime(),
      notes: 'Notes',
      status: 'accepted',
      rejection_reason: null,
      created_by: null,
      approved_by: null,
      updated_at: 0,
      is_deleted: 0,
    };
    const out = scheduleRowToSchedule(row as any);
    expect(out.id).toBe('s1');
    expect(out.scheduled_date).toBe('2025-06-01');
    expect(out.status).toBe('accepted');
    expect(out.farmer_display_name).toBe('Jane Doe');
  });
});

describe('visitRowToVisit', () => {
  it('maps row to Visit', () => {
    const row = {
      id: 'v1',
      officer: 'o1',
      farmer: 'f1',
      farm: 'farm1',
      schedule_id: 's1',
      latitude: -6.1,
      longitude: 39.2,
      photo_uri: null,
      notes: 'Ok',
      activity_type: 'farm_to_farm_visits',
      verification_status: 'pending',
      created_at: 1700000000000,
      updated_at: 1700000000000,
      is_deleted: 0,
    };
    const out = visitRowToVisit(row as any);
    expect(out.id).toBe('v1');
    expect(out.verification_status).toBe('pending');
    expect(out.activity_type).toBe('farm_to_farm_visits');
    expect(out.created_at).toBe(new Date(1700000000000).toISOString());
  });
});
