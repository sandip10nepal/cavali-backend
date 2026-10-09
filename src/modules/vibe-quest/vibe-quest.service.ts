import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { sseService } from '../../services/sse.service';
import { VibeQuestEngine } from './vibe-quest.engine';
import {
  VibeQuestConfig,
  VibeQuestRestaurantSettings,
  VibeQuestValidationResult,
} from './vibe-quest.types';

export class VibeQuestService {
  private static getDb() {
    const db = MultiTenantDbService.getDb();
    if (!db) {
      throw new Error('Database is unavailable');
    }
    return db;
  }

  /**
   * Retrieve the full Vibe Quest settings for admin (including draft & published).
   */
  static async getSettings(restaurantId: string): Promise<VibeQuestRestaurantSettings | null> {
    const db = this.getDb();
    const rest = await db.collection<any>('restaurants').findOne(
      { _id: restaurantId },
      { projection: { 'settings.vibe_quest': 1 } }
    );
    return (rest?.settings?.vibe_quest as VibeQuestRestaurantSettings) || null;
  }

  /**
   * Retrieve only the published configuration for the public customer client.
   */
  static async getPublishedConfig(restaurantId: string): Promise<VibeQuestConfig | null> {
    const db = this.getDb();
    const rest = await db.collection<any>('restaurants').findOne(
      { _id: restaurantId },
      { projection: { 'settings.vibe_quest': 1 } }
    );
    const vq = rest?.settings?.vibe_quest as VibeQuestRestaurantSettings | undefined;
    if (!vq || !vq.enabled || !vq.published) {
      return null;
    }
    return vq.published;
  }

  /**
   * Save or update draft configuration.
   */
  static async updateDraft(restaurantId: string, draft: VibeQuestConfig): Promise<boolean> {
    const db = this.getDb();
    const now = new Date().toISOString();
    draft.updated_at = now;

    await db.collection<any>('restaurants').updateOne(
      { _id: restaurantId },
      {
        $set: {
          'settings.vibe_quest.draft': draft,
          'settings.vibe_quest.updated_at': now,
        },
      },
      { upsert: false }
    );
    return true;
  }

  /**
   * Validate draft against live catalog.
   */
  static async validateDraft(restaurantId: string): Promise<VibeQuestValidationResult> {
    const db = this.getDb();
    const settings = await this.getSettings(restaurantId);
    if (!settings?.draft) {
      return {
        valid: false,
        errors: [{ message: 'No draft configuration found to validate', severity: 'error' }],
      };
    }

    const categories = await db.collection<any>('menu_categories').find({ restaurant_id: restaurantId }).toArray();
    const products = await db.collection<any>('menu_items').find({ restaurant_id: restaurantId }).toArray();

    return VibeQuestEngine.validateConfig(settings.draft, categories, products);
  }

  /**
   * Publish draft if valid.
   */
  static async publishConfig(restaurantId: string): Promise<{
    success: boolean;
    version: number;
    validation: VibeQuestValidationResult;
  }> {
    const db = this.getDb();
    const settings = await this.getSettings(restaurantId);
    if (!settings?.draft) {
      return {
        success: false,
        version: 0,
        validation: {
          valid: false,
          errors: [{ message: 'No draft configuration found to publish', severity: 'error' }],
        },
      };
    }

    const validation = await this.validateDraft(restaurantId);
    if (!validation.valid) {
      return {
        success: false,
        version: settings.published_version || 0,
        validation,
      };
    }

    const now = new Date().toISOString();
    const nextVersion = (settings.published_version || 0) + 1;
    const publishedConfig: VibeQuestConfig = {
      ...settings.draft,
      version: nextVersion,
      enabled: true,
      published_at: now,
    };

    await db.collection<any>('restaurants').updateOne(
      { _id: restaurantId },
      {
        $set: {
          'settings.vibe_quest.enabled': true,
          'settings.vibe_quest.published_version': nextVersion,
          'settings.vibe_quest.published': publishedConfig,
          'settings.vibe_quest.published_at': now,
          'settings.vibe_quest.updated_at': now,
        },
      }
    );

    // Broadcast SSE update
    sseService.broadcast(
      {
        type: 'vibe_quest_updated',
        version: nextVersion,
        restaurant_id: restaurantId,
      },
      restaurantId
    );

    return {
      success: true,
      version: nextVersion,
      validation,
    };
  }

  /**
   * Toggle Vibe Quest enabled state.
   */
  static async setEnabled(restaurantId: string, enabled: boolean): Promise<boolean> {
    const db = this.getDb();
    const now = new Date().toISOString();
    await db.collection<any>('restaurants').updateOne(
      { _id: restaurantId },
      {
        $set: {
          'settings.vibe_quest.enabled': enabled,
          'settings.vibe_quest.updated_at': now,
        },
      }
    );

    sseService.broadcast(
      {
        type: 'vibe_quest_updated',
        enabled,
        restaurant_id: restaurantId,
      },
      restaurantId
    );

    return true;
  }

  /**
   * Record lightweight, fire-and-forget discovery event.
   */
  static async recordEvent(
    restaurantId: string,
    event: {
      event_type: string;
      question_id?: string;
      answer_id?: string;
      product_id?: string;
      session_id?: string;
      metadata?: any;
    }
  ): Promise<void> {
    try {
      const db = this.getDb();
      await db.collection<any>('vibe_quest_events').insertOne({
        restaurant_id: restaurantId,
        event_type: event.event_type,
        question_id: event.question_id,
        answer_id: event.answer_id,
        product_id: event.product_id,
        session_id: event.session_id,
        metadata: event.metadata,
        created_at: new Date(),
      });
    } catch (err: any) {
      console.warn('[VibeQuest] Failed to record event:', err.message);
    }
  }

  /**
   * Get aggregate metrics for admin panel.
   */
  static async getAnalyticsSummary(restaurantId: string): Promise<any> {
    const db = this.getDb();
    const collection = db.collection<any>('vibe_quest_events');

    const totalEvents = await collection.countDocuments({ restaurant_id: restaurantId });

    const eventCounts = await collection
      .aggregate([
        { $match: { restaurant_id: restaurantId } },
        { $group: { _id: '$event_type', count: { $sum: 1 } } },
      ])
      .toArray();

    const topAnswers = await collection
      .aggregate([
        { $match: { restaurant_id: restaurantId, event_type: 'answer_selected' } },
        { $group: { _id: { question_id: '$question_id', answer_id: '$answer_id' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    const topProductsSelected = await collection
      .aggregate([
        { $match: { restaurant_id: restaurantId, event_type: 'recommendation_selected' } },
        { $group: { _id: '$product_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    return {
      total_events: totalEvents,
      event_counts: Object.fromEntries(eventCounts.map((x: any) => [x._id, x.count])),
      top_answers: topAnswers.map((x: any) => ({
        question_id: x._id.question_id,
        answer_id: x._id.answer_id,
        count: x.count,
      })),
      top_products_selected: topProductsSelected.map((x: any) => ({
        product_id: x._id,
        count: x.count,
      })),
    };
  }
}
