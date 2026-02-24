import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('entity') entity!: string;
  @field('payload') payload!: string;
  @field('operation') operation!: 'CREATE' | 'UPDATE' | 'DELETE';
  @field('status') status!: 'pending' | 'synced';
  @field('timestamp') timestamp!: number;
}