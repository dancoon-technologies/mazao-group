// database/models/Farmer.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Farmer extends Model {
  static table = 'farmers'

  @field('first_name') first_name!: string
  @field('middle_name') middle_name!: string | null
  @field('last_name') last_name!: string
  @field('display_name') display_name!: string | null
  @field('phone') phone!: string | null
  @field('latitude') latitude!: string | null
  @field('longitude') longitude!: string | null
  @field('crop_type') crop_type!: string | null
  @field('assigned_officer') assigned_officer!: string | null
  @field('created_at') created_at!: string | null
}
