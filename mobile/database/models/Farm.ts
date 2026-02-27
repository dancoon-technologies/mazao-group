// database/models/Farm.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Farm extends Model {
  static table = 'farms'

  @field('farmer_id') farmer_id!: string
  @field('village') village!: string
  @field('latitude') latitude!: number
  @field('longitude') longitude!: number
  @field('plot_size') plot_size!: string | null
  @field('crop_type') crop_type!: string | null
  @field('region_id') region_id!: number | null
  @field('county_id') county_id!: number | null
  @field('sub_county_id') sub_county_id!: number | null
  @field('region') region!: string | null
  @field('county') county!: string | null
  @field('sub_county') sub_county!: string | null
  @field('created_at') created_at!: number
}
