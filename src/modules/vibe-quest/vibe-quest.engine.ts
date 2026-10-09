import {
  VibeQuestBranchRule,
  VibeQuestCondition,
  VibeQuestConfig,
  VibeQuestConfigSettings,
  VibeQuestDestination,
  VibeQuestQuestion,
  VibeQuestSessionState,
  VibeQuestValidationResult,
  VibeQuestValidationError,
} from './vibe-quest.types';

export class VibeQuestEngine {
  /**
   * Evaluate a single condition against current session and cart.
   */
  static evaluateCondition(
    cond: VibeQuestCondition,
    session: VibeQuestSessionState,
    cart: Array<{ id?: string; _id?: string; category_id?: string; category_ids?: string[] }>,
    catalogProducts?: Map<string, any>
  ): boolean {
    const field = cond.field || '';
    const value = cond.value;

    switch (cond.operator) {
      case 'answer_selected': {
        if (field) {
          const selected = session.answers[field] || [];
          return value ? selected.includes(String(value)) : selected.length > 0;
        }
        return Object.values(session.answers).some((ansList) =>
          ansList.includes(String(value))
        );
      }

      case 'answer_not_selected': {
        if (field) {
          const selected = session.answers[field] || [];
          return value ? !selected.includes(String(value)) : selected.length === 0;
        }
        return !Object.values(session.answers).some((ansList) =>
          ansList.includes(String(value))
        );
      }

      case 'signal_present': {
        const sig = field || String(value);
        return (session.signals[sig] || 0) > 0;
      }

      case 'question_answered': {
        const qid = field || String(value);
        return session.questions_answered.includes(qid);
      }

      case 'question_skipped': {
        const qid = field || String(value);
        return session.questions_skipped.includes(qid);
      }

      case 'question_not_seen': {
        const qid = field || String(value);
        return !session.questions_shown.includes(qid);
      }

      case 'stage_is': {
        const stage = field || String(value);
        return session.current_stage === stage;
      }

      case 'cart_has_category': {
        const catId = field || String(value);
        return cart.some((item) => {
          const cids = Array.isArray(item.category_ids) && item.category_ids.length > 0
            ? item.category_ids
            : [item.category_id || ''];
          return cids.includes(catId);
        });
      }

      case 'cart_not_has_category': {
        const catId = field || String(value);
        return !cart.some((item) => {
          const cids = Array.isArray(item.category_ids) && item.category_ids.length > 0
            ? item.category_ids
            : [item.category_id || ''];
          return cids.includes(catId);
        });
      }

      case 'cart_has_product': {
        const pid = field || String(value);
        return cart.some((item: any) => {
          if ((item.id || item._id) === pid) return true;
          if (Array.isArray(item.selectedModifiers)) {
            return item.selectedModifiers.some((m: any) => m.id === pid || m.optionId === pid);
          }
          return false;
        });
      }

      case 'cart_not_has_product': {
        const pid = field || String(value);
        return !cart.some((item: any) => {
          if ((item.id || item._id) === pid) return true;
          if (Array.isArray(item.selectedModifiers)) {
            return item.selectedModifiers.some((m: any) => m.id === pid || m.optionId === pid);
          }
          return false;
        });
      }

      case 'product_available': {
        const pid = field || String(value);
        const prod = catalogProducts?.get(pid);
        return prod ? prod.available !== false : false;
      }

      case 'recommendation_selected': {
        const pid = field || String(value);
        return session.recommendations_selected.includes(pid);
      }

      default:
        return true;
    }
  }

  /**
   * Determine whether a question should be shown in the current context.
   */
  static isQuestionEligible(
    question: VibeQuestQuestion,
    session: VibeQuestSessionState,
    cart: any[],
    settings?: VibeQuestConfigSettings
  ): boolean {
    if (!question.active) return false;

    // Global and question dismissal checks
    if (session.questions_dismissed.includes(question.id) || session.questions_dismissed.includes('*')) {
      return false;
    }

    // Repeat policy checks
    if (question.repeat_policy === 'show_once') {
      if (session.questions_shown.includes(question.id) || session.questions_skipped.includes(question.id)) return false;
    }

    if (question.repeat_policy === 'suppress_if_skipped') {
      if (session.questions_skipped.includes(question.id)) {
        return false;
      }
    }

    // Dessert specific cart condition check
    if (question.stage === 'dessert' || question.repeat_policy === 'cart_conditional') {
      if (session.questions_dismissed.includes(question.id)) return false;

      // Check if dessert already in cart
      const dessertCatIds = settings?.dessert_category_ids || ['CAT_DESSERTS'];
      const hasDessertInCart = cart.some((item) => {
        const cids = Array.isArray(item.category_ids) && item.category_ids.length > 0
          ? item.category_ids
          : [item.category_id || ''];
        return dessertCatIds.some((dcid) => cids.includes(dcid));
      });

      if (hasDessertInCart) return false;
    }

    // Display conditions
    if (question.display_conditions && question.display_conditions.length > 0) {
      for (const cond of question.display_conditions) {
        if (!this.evaluateCondition(cond, session, cart)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Resolve the next destination given a question, selected answers, and session state.
   */
  static resolveNextDestination(
    question: VibeQuestQuestion,
    selectedAnswerIds: string[],
    session: VibeQuestSessionState,
    cart: any[]
  ): VibeQuestDestination {
    // 1. Check custom branches first (evaluated in order)
    if (question.branches && question.branches.length > 0) {
      for (const branch of question.branches) {
        const allMatch = branch.conditions.every((c) => this.evaluateCondition(c, session, cart));
        if (allMatch) {
          return branch.destination;
        }
      }
    }

    // 2. Check selected answer destinations
    if (selectedAnswerIds.length > 0) {
      for (const ansId of selectedAnswerIds) {
        const ans = question.answers.find((a) => a.id === ansId);
        if (ans && ans.destination) {
          return ans.destination;
        }
      }
    }

    // 3. Fallback to question default destination or next_stage
    return question.default_destination || { type: 'next_stage' };
  }

  /**
   * Rank and filter recommendations deterministically.
   */
  static rankRecommendations(options: {
    question?: VibeQuestQuestion;
    selectedAnswerIds?: string[];
    config: VibeQuestConfig;
    catalogProducts: any[];
    cart: any[];
    session: VibeQuestSessionState;
  }): any[] {
    const { question, selectedAnswerIds = [], config, catalogProducts, session } = options;

    const recConfig = question?.recommendation_config || {};
    const resultCount = recConfig.result_count || 3;
    const diversityLimit = recConfig.diversity_limit_per_category || 2;

    // Collect answers
    const answers = (question?.answers || []).filter((a) => selectedAnswerIds.includes(a.id));

    // Combine pinned products
    const pinnedSet = new Set<string>();
    const eligibleCategories = new Set<string>(recConfig.eligible_category_ids || []);
    const excludedProducts = new Set<string>(recConfig.excluded_product_ids || []);

    // Also exclude known test items
    excludedProducts.add('ITM_6D32A3982F2D'); // Samosa Chaat Test
    excludedProducts.add('ITM_09618EBFB068'); // Samosa Chaat Test 2
    excludedProducts.add('sazdxfcgvhb'); // Junk Custom Mix item

    answers.forEach((ans) => {
      (ans.pinned_product_ids || []).forEach((pid) => pinnedSet.add(pid));
      (ans.eligible_category_ids || []).forEach((cid) => eligibleCategories.add(cid));
      (ans.excluded_product_ids || []).forEach((pid) => excludedProducts.add(pid));
    });

    // Filter available catalog products
    const eligibleProducts = catalogProducts.filter((p) => {
      const pid = p._id || p.id;
      if (p.available === false) return false;
      if (excludedProducts.has(pid)) return false;

      // Category filter if configured
      if (eligibleCategories.size > 0) {
        const cids = Array.isArray(p.category_ids) && p.category_ids.length > 0
          ? p.category_ids
          : [p.category_id || ''];
        const matchesCategory = cids.some((c: string) => eligibleCategories.has(c));
        if (!matchesCategory) return false;
      }
      return true;
    });

    // Score products
    const scored = eligibleProducts.map((p) => {
      const pid = p._id || p.id;
      let score = 0;

      // Pinned boost
      if (pinnedSet.has(pid)) {
        score += 100;
      }

      // Verified product tags vs active preference signals
      const prodTags = (config.product_tags && config.product_tags[pid]) || [];
      for (const tag of prodTags) {
        const sigScore = session.signals[tag] || 0;
        if (sigScore > 0) {
          score += sigScore * 10;
        }
      }

      return { product: p, score };
    });

    // Deduplicate by normalized name (to avoid identical dishes like Chips and Queso appearing twice)
    const seenNames = new Set<string>();
    const deduped: typeof scored = [];

    // Sort initially by score desc, then sort_order asc
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.product.sort_order || 99) - (b.product.sort_order || 99);
    });

    for (const item of scored) {
      const normName = (item.product.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        deduped.push(item);
      }
    }

    // Apply category diversity
    const categoryCounts: Record<string, number> = {};
    const diverseResults: any[] = [];

    for (const item of deduped) {
      const catId = item.product.category_id || (item.product.category_ids && item.product.category_ids[0]) || 'misc';
      const curCount = categoryCounts[catId] || 0;

      if (curCount < diversityLimit || diverseResults.length < resultCount) {
        categoryCounts[catId] = curCount + 1;
        diverseResults.push(item.product);
      }

      if (diverseResults.length >= resultCount) break;
    }

    // Fallback if empty
    if (diverseResults.length === 0 && recConfig.fallback_category_id) {
      const fallbackItems = catalogProducts
        .filter((p) => {
          const cids = p.category_ids?.length ? p.category_ids : [p.category_id];
          return cids.includes(recConfig.fallback_category_id) && p.available !== false && !excludedProducts.has(p._id || p.id);
        })
        .slice(0, resultCount);
      return fallbackItems;
    }

    return diverseResults;
  }

  /**
   * Validate entire configuration against catalog before publishing.
   */
  static validateConfig(
    config: VibeQuestConfig,
    catalogCategories: any[],
    catalogProducts: any[]
  ): VibeQuestValidationResult {
    const errors: VibeQuestValidationError[] = [];
    const questionIds = new Set<string>();
    const answerIds = new Set<string>();

    const catIdSet = new Set(catalogCategories.map((c) => c._id || c.id));
    const prodMap = new Map(catalogProducts.map((p) => [p._id || p.id, p]));

    // Check questions
    for (const q of config.questions || []) {
      if (!q.id) {
        errors.push({ question_id: 'unknown', message: 'Question missing ID', severity: 'error' });
        continue;
      }
      if (questionIds.has(q.id)) {
        errors.push({ question_id: q.id, message: `Duplicate question ID: ${q.id}`, severity: 'error' });
      }
      questionIds.add(q.id);

      if (!q.question_text) {
        errors.push({ question_id: q.id, message: `Question ${q.id} missing display text`, severity: 'error' });
      }

      if (!q.answers || q.answers.length === 0) {
        errors.push({ question_id: q.id, message: `Question ${q.id} has no answer options`, severity: 'error' });
      }

      // Check answers
      for (const a of q.answers || []) {
        if (!a.id) {
          errors.push({ question_id: q.id, message: 'Answer missing ID', severity: 'error' });
          continue;
        }
        if (answerIds.has(a.id)) {
          errors.push({ question_id: q.id, answer_id: a.id, message: `Duplicate answer ID: ${a.id}`, severity: 'error' });
        }
        answerIds.add(a.id);

        // Check answer destination
        if (a.destination) {
          this.validateDestination(a.destination, q.id, a.id, questionIds, catIdSet, prodMap, errors);
        }

        // Check pinned products
        for (const pid of a.pinned_product_ids || []) {
          const p = prodMap.get(pid);
          if (!p) {
            errors.push({
              question_id: q.id,
              answer_id: a.id,
              message: `Pinned product '${pid}' does not exist in catalog`,
              severity: 'error',
            });
          } else if (p.available === false) {
            errors.push({
              question_id: q.id,
              answer_id: a.id,
              message: `Pinned product '${p.name}' (${pid}) is currently unavailable`,
              severity: 'warning',
            });
          }
        }
      }

      // Check default destination
      if (q.default_destination) {
        this.validateDestination(q.default_destination, q.id, undefined, questionIds, catIdSet, prodMap, errors);
      }

      // Check branches
      for (const branch of q.branches || []) {
        this.validateDestination(branch.destination, q.id, undefined, questionIds, catIdSet, prodMap, errors);
      }
    }

    // Detect cycles in question destinations
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (currId: string): boolean => {
      visited.add(currId);
      recStack.add(currId);

      const q = config.questions.find((x) => x.id === currId);
      if (q) {
        const nextQIds: string[] = [];
        if (q.default_destination?.type === 'question' && q.default_destination.ref_id) {
          nextQIds.push(q.default_destination.ref_id);
        }
        (q.branches || []).forEach((b) => {
          if (b.destination.type === 'question' && b.destination.ref_id) {
            nextQIds.push(b.destination.ref_id);
          }
        });
        (q.answers || []).forEach((a) => {
          if (a.destination?.type === 'question' && a.destination.ref_id) {
            nextQIds.push(a.destination.ref_id);
          }
        });

        for (const nxt of nextQIds) {
          if (!visited.has(nxt)) {
            if (hasCycle(nxt)) return true;
          } else if (recStack.has(nxt)) {
            return true;
          }
        }
      }

      recStack.delete(currId);
      return false;
    };

    for (const q of config.questions) {
      if (!visited.has(q.id)) {
        if (hasCycle(q.id)) {
          errors.push({
            question_id: q.id,
            message: `Circular branching loop detected starting at question ${q.id}`,
            severity: 'error',
          });
          break;
        }
      }
    }

    const hasErrors = errors.some((e) => e.severity === 'error');
    return { valid: !hasErrors, errors };
  }

  private static validateDestination(
    dest: VibeQuestDestination,
    qid: string,
    aid: string | undefined,
    questionIds: Set<string>,
    catIdSet: Set<string>,
    prodMap: Map<string, any>,
    errors: VibeQuestValidationError[]
  ) {
    if (dest.type === 'question' && dest.ref_id) {
      // Must be a valid question id in the config
      // Note: we check against full config in a second pass if needed, or target exists
    } else if (dest.type === 'category' && dest.ref_id) {
      if (!catIdSet.has(dest.ref_id)) {
        errors.push({
          question_id: qid,
          answer_id: aid,
          message: `Destination category '${dest.ref_id}' does not exist`,
          severity: 'error',
        });
      }
    } else if ((dest.type === 'product' || dest.type === 'product_customization') && dest.ref_id) {
      if (!prodMap.has(dest.ref_id)) {
        errors.push({
          question_id: qid,
          answer_id: aid,
          message: `Destination product '${dest.ref_id}' does not exist`,
          severity: 'error',
        });
      }
    }
  }
}
