export type VibeQuestStage = 'hookah' | 'food' | 'dessert' | 'drinks' | 'checkout';

export type VibeQuestQuestionType = 'single_select' | 'multi_select';

export type VibeQuestDestinationType =
  | 'question'
  | 'recommendations'
  | 'product'
  | 'product_customization'
  | 'category'
  | 'custom_mix_lab'
  | 'daku'
  | 'next_stage'
  | 'end_discovery';

export interface VibeQuestDestination {
  type: VibeQuestDestinationType;
  ref_id?: string; // target question_id, product_id, category_id, stage, etc.
}

export type VibeQuestConditionOperator =
  | 'answer_selected'
  | 'answer_not_selected'
  | 'signal_present'
  | 'question_answered'
  | 'question_skipped'
  | 'question_not_seen'
  | 'stage_is'
  | 'cart_has_category'
  | 'cart_not_has_category'
  | 'cart_has_product'
  | 'cart_not_has_product'
  | 'product_available'
  | 'recommendation_selected';

export interface VibeQuestCondition {
  operator: VibeQuestConditionOperator;
  field?: string; // questionId, categoryId, productId, signal
  value?: any;
}

export interface VibeQuestBranchRule {
  id: string;
  description?: string;
  conditions: VibeQuestCondition[];
  destination: VibeQuestDestination;
}

export interface VibeQuestAnswer {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  active: boolean;
  sort_order: number;
  signals: string[];
  weights?: Record<string, number>;
  pinned_product_ids?: string[];
  eligible_category_ids?: string[];
  excluded_product_ids?: string[];
  destination?: VibeQuestDestination;
  conditions?: VibeQuestCondition[];
}

export type VibeQuestRepeatPolicy = 'show_once' | 'show_always' | 'suppress_if_skipped' | 'cart_conditional';

export interface VibeQuestRecommendationConfig {
  result_count?: number;
  min_score?: number;
  diversity_limit_per_category?: number;
  eligible_category_ids?: string[];
  excluded_product_ids?: string[];
  fallback_category_id?: string;
  inline?: boolean;
}

export interface VibeQuestQuestion {
  id: string;
  stage: VibeQuestStage;
  title: string;
  question_text: string;
  helper_text?: string;
  emoji?: string;
  type: VibeQuestQuestionType;
  active: boolean;
  sort_order: number;
  priority?: number;
  required: boolean;
  skippable: boolean;
  repeat_policy: VibeQuestRepeatPolicy;
  display_conditions?: VibeQuestCondition[];
  answers: VibeQuestAnswer[];
  default_destination?: VibeQuestDestination;
  branches?: VibeQuestBranchRule[];
  recommendation_config?: VibeQuestRecommendationConfig;
}

export interface VibeQuestConfigSettings {
  dessert_category_ids: string[];
  dessert_trigger_stage: VibeQuestStage;
  intro_title?: string;
  intro_subtitle?: string;
  reactions?: Record<string, string>;
}

export interface VibeQuestConfig {
  version: number;
  enabled: boolean;
  questions: VibeQuestQuestion[];
  settings: VibeQuestConfigSettings;
  product_tags?: Record<string, string[]>; // productId -> verified tags
  updated_at?: string;
  published_at?: string;
}

export interface VibeQuestRestaurantSettings {
  enabled: boolean;
  published_version: number;
  draft: VibeQuestConfig;
  published?: VibeQuestConfig;
  updated_at: string;
  published_at?: string;
}

export interface VibeQuestSessionState {
  answers: Record<string, string[]>;
  signals: Record<string, number>;
  questions_shown: string[];
  questions_answered: string[];
  questions_skipped: string[];
  questions_dismissed: string[];
  recommendations_shown: string[];
  recommendations_selected: string[];
  cart_items_added: string[];
  current_stage: VibeQuestStage;
  config_version?: number;
}

export interface VibeQuestValidationError {
  question_id?: string;
  answer_id?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface VibeQuestValidationResult {
  valid: boolean;
  errors: VibeQuestValidationError[];
}
