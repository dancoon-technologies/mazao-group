// database/models/Visit.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Visit extends Model {
    static table = 'visits'

    @field('officer') officer!: string
    @field('farmer') farmer!: string
    @field('farm') farm!: string
    @field('latitude') latitude!: number
    @field('longitude') longitude!: number
    @field('notes') notes!: string
    @field('activity_type') activity_type!: string
    @field('updated_at') updated_at!: number
    @field('is_deleted') is_deleted!: boolean
}