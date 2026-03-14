/**
 * Tests for store normalizers (server response -> local row shape).
 */

import {
  normalizeServerVisit,
  normalizeServerSchedule,
  normalizeServerFarmer,
  normalizeServerFarm,
} from '@/store/helpers';

describe('normalizeServerVisit', () => {
  it('normalizes full visit record', () => {
    const record = {
      id: 'v1',
      officer: 'o1',
      farmer: 'f1',
      farm: 'farm1',
      schedule: 's1',
      latitude: -6.1,
      longitude: 39.2,
      photo: 'https://example.com/photo.jpg',
      notes: 'Notes',
      activity_type: 'farm_to_farm_visits',
      verification_status: 'pending',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
      is_deleted: false,
    };
    const out = normalizeServerVisit(record) as any;
    expect(out.id).toBe('v1');
    expect(out.officer).toBe('o1');
    expect(out.farmer).toBe('f1');
    expect(out.schedule_id).toBe('s1');
    expect(out.latitude).toBe(-6.1);
    expect(out.longitude).toBe(39.2);
    expect(out.verification_status).toBe('pending');
    expect(typeof out.created_at).toBe('number');
    expect(typeof out.updated_at).toBe('number');
  });

  it('uses schedule_id when schedule missing', () => {
    const out = normalizeServerVisit({ id: 'v2', schedule_id: 's2' } as any) as any;
    expect(out.schedule_id).toBe('s2');
  });

  it('handles null officer and farmer', () => {
    const out = normalizeServerVisit({ id: 'v3', officer: null, farmer: null } as any) as any;
    expect(out.officer).toBe('');
    expect(out.farmer).toBe('');
  });
});

describe('normalizeServerSchedule', () => {
  it('normalizes full schedule with scheduled_date string', () => {
    const record = {
      id: 's1',
      officer: 'o1',
      farmer: 'f1',
      farmer_display_name: 'Jane',
      farm: 'farm1',
      farm_display_name: 'Plot A',
      scheduled_date: '2025-06-01',
      notes: 'Notes',
      status: 'accepted',
      rejection_reason: null,
      created_by: 'o1',
      approved_by: 'admin1',
      updated_at: '2025-01-01T00:00:00Z',
      is_deleted: false,
    };
    const out = normalizeServerSchedule(record) as any;
    expect(out.id).toBe('s1');
    expect(out.scheduled_date).toBe(new Date('2025-06-01T00:00:00Z').getTime());
    expect(out.status).toBe('accepted');
  });
});

describe('normalizeServerFarmer', () => {
  it('normalizes full farmer', () => {
    const record = {
      id: 'f1',
      first_name: 'Jane',
      middle_name: 'M',
      last_name: 'Doe',
      display_name: 'Jane Doe',
      phone: '+255111',
      latitude: '-6.1',
      longitude: '39.2',
      crop_type: 'Maize',
      assigned_officer: 'o1',
      created_at: '2025-01-01T00:00:00Z',
    };
    const out = normalizeServerFarmer(record) as any;
    expect(out.first_name).toBe('Jane');
    expect(out.last_name).toBe('Doe');
    expect(out.latitude).toBe('-6.1');
    expect(typeof out.created_at).toBe('number');
  });
});

describe('normalizeServerFarm', () => {
  it('normalizes full farm', () => {
    const record = {
      id: 'farm1',
      farmer: 'f1',
      village: 'Village A',
      latitude: -6.1,
      longitude: 39.2,
      plot_size: '1 ha',
      crop_type: 'Maize',
      region_id: 1,
      county_id: 2,
      sub_county_id: 3,
      region: 'North',
      county: 'C',
      sub_county: 'SC',
      created_at: '2025-01-01T00:00:00Z',
    };
    const out = normalizeServerFarm(record) as any;
    expect(out.id).toBe('farm1');
    expect(out.farmer_id).toBe('f1');
    expect(out.region_id).toBe(1);
    expect(out.county_id).toBe(2);
    expect(out.sub_county_id).toBe(3);
    expect(typeof out.created_at).toBe('number');
  });
});
