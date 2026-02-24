// database/models/Visit.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Visit extends Model {
  static table = 'visits'

  @field('officer') officer!: string
  @field('farmer') farmer!: string
  @field('farm') farm!: string | null
  @field('latitude') latitude!: number
  @field('longitude') longitude!: number
  @field('photo_uri') photo_uri!: string | null
  @field('notes') notes!: string | null
  @field('activity_type') activity_type!: string | null
  @field('verification_status') verification_status!: string | null
  @field('created_at') created_at!: number | null
  @field('updated_at') updated_at!: number
  @field('is_deleted') is_deleted!: boolean
}