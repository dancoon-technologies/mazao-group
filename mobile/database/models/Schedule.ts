// database/models/Schedule.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Schedule extends Model {
  static table = 'schedules'

  @field('officer') officer!: string
  @field('farmer') farmer!: string | null
  @field('scheduled_date') scheduled_date!: number
  @field('notes') notes!: string | null
  @field('status') status!: string
  @field('created_by') created_by!: string | null
  @field('approved_by') approved_by!: string | null
  @field('updated_at') updated_at!: number
  @field('is_deleted') is_deleted!: boolean
}