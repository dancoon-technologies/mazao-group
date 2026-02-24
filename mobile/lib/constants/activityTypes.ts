/**
 * Field activity types per README §7.2 / backend Visit.ActivityType
 */
export const ACTIVITY_TYPES = [
  { value: 'order_collection', label: 'Order collection' },
  { value: 'debt_collections', label: 'Debt collections' },
  { value: 'account_opening', label: 'Account opening' },
  { value: 'farm_to_farm_visits', label: 'Farm to farm visits' },
  { value: 'key_farm_visits', label: 'Key farm visits' },
  { value: 'group_training', label: 'Group training' },
  { value: 'common_interest_group_training', label: 'Common Interest Group training' },
  { value: 'stakeholder_group_training', label: 'Stakeholder group training' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'market_day_activation', label: 'Market day activation' },
  { value: 'market_survey', label: 'Market survey' },
  { value: 'competition_intelligence', label: 'Competition intelligence gathering' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'demo_set_up', label: 'Demo set up' },
  { value: 'spot_demo', label: 'Spot demo' },
  { value: 'demo_site_training', label: 'Demo site training' },
  { value: 'stakeholder_engagement', label: 'Stakeholder engagement' },
  { value: 'farmers_cooperative_engagement', label: 'Farmers Cooperative society engagement' },
  { value: 'stockists_activation', label: 'Stockists activation' },
  { value: 'merchandising', label: 'Merchandising' },
  { value: 'route_storming', label: 'Route storming' },
  { value: 'farming_pocket_storming', label: 'Farming pocket storming' },
  { value: 'counter_staff_training', label: 'Counter staff training' },
  { value: 'counter_staff_bonding', label: 'Counter staff bonding session' },
  { value: 'key_farmers_bonding', label: 'Key Farmers bonding session / Goat eating sessions' },
] as const;

export const DEFAULT_ACTIVITY_TYPE = 'farm_to_farm_visits';
