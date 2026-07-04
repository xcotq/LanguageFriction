# UserResponse -> LearningEvidence 提案

## 结论

当前领域模型和数据库结构已经足够承接第一版 `UserResponse -> LearningEvidence`，不需要新增持久化实体，也不需要修改 `docs/initial-domain-model.md`。

第一版建议实现一条清晰的同步主流程：

```text
用户提交 PracticeItem 答案
-> 写入 UserResponse draft
-> 加载 PracticeItem / PracticeItemTarget / LearningTarget / LearningTargetEntity
-> 运行 PracticeResponseEvaluationService
-> 生成每个 LearningTarget 对应的 LearningEvidence
-> 同一事务写入 UserResponse + LearningEvidence
-> 用 LearningEvidence 更新 LearningTarget 的复习状态
-> 返回用户可读反馈
```

核心原则保持领域模型里的边界：

- `UserResponse` 只保存用户这次怎么答。
- `LearningEvidence` 保存这次回答对某个 `LearningTarget` 的判断。
- `LearningTarget` 保存长期掌握状态和调度状态。
- `PracticeItem` 可以关联多个 target，所以一次回答必须能产出多条 evidence。
- 用户答案会是复杂语句，非空答案必须经过 LLM 结构化评估后才能生成掌握证据；本地逻辑只做预处理、空答案短路和 LLM 不可用时的 `not_tested` 兜底。
- 掌握程度第一版不单独持久化成 numeric score，而是由 `LearningEvidence.result`、`confidence`、`LearningTarget.stability`、`dueAt`、`reviewCount`、`lapseCount` 共同表达。

## 已读依据

- `docs/initial-domain-model.md`
- `proposal/knowledge-point-to-learning-target-practice-item.md`
- `src/types/domain.ts`
- `src/data/database/schema.ts`
- `src/data/dao/learning.dao.ts`
- `src/data/repositories/practice.repository.ts`
- `src/services/knowledge-practice/practice-item-generation-service.ts`
- `src/app/practice/[practiceItemId].tsx`

## 当前实现观察

代码里已经有这些基础能力：

- `PracticeItem`、`PracticeItemTarget`、`UserResponse`、`LearningEvidence`、`LearningTarget` 表已经存在。
- `PracticeRepository.recordResponse()` 已经能在事务中写入 response 和 evidence。
- `PracticeRepository.recordUnevaluatedResponse()` 目前会保存回答，并为每个 target 生成 `not_tested` evidence。
- `PracticeItemGenerationService` 现在主要生成两类题：
    - `expression_recall`，类型为 `free_response`
    - `utterance_production`，类型为 `scenario_response`
- 当前 UI 允许用户提交答案，但没有真正评估，也没有更新 `LearningTarget`。

因此第一版要补的不是表，而是评估服务、证据映射、target 更新规则和 UI 调用路径。

## 目标

第一版目标是回答这个问题：

> 用户对这个 `PracticeItem` 的回答，说明他对相关 `LearningTarget` 掌握到什么程度？

落地到数据上，就是：

```text
UserResponse
-> LearningEvidence[]
-> LearningTarget scheduling update
```

第一版只覆盖已有 practice generation 产生的题型：

- `expression_recall`
- `utterance_production`

暂不覆盖：

- `recognition`
- `transfer`
- `distinction`
- `multiple_choice`
- `correction`
- 多轮追问式评估
- FSRS 或更复杂的记忆模型

## 数据模型影响

本提案不新增表，也不要求改动现有字段。

可以利用现有的 `unknown` JSON 字段承载第一版需要的结构：

- `UserResponse.answer`
- `UserResponse.feedback`
- `PracticeItem.prompt`
- `PracticeItem.expectedAnswer`
- `PracticeItem.acceptableAnswers`
- `PracticeItem.contextSnapshot`
- `LearningEvidence.error`

如果后续要引入以下能力，才需要先更新 `docs/initial-domain-model.md`：

- 独立的 `EvaluationRun` / `EvaluationTrace`
- 单独持久化的 mastery numeric score
- 用户 hint / reveal / retry 事件流
- 人工改判记录
- 多 evaluator 投票或审计日志

## 回答输入结构

虽然 `UserResponse.answer` 现在可以直接保存字符串，但建议第一版评估入口内部统一成结构化输入。

UI 可以继续只让用户输入文本，提交时包装为：

```ts
type PracticeAnswerPayload = {
    text: string;
    interaction?: {
        revealedAnswerBeforeSubmit?: boolean;
        usedHint?: boolean;
    };
};
```

这样可以在不改表的情况下支持 `hinted`：

- 如果用户提交前看过答案，且答案本身正确，证据结果应优先是 `hinted` 而不是 `correct`。
- 如果用户提交前看过答案，但仍答错，则是 `failed`，并在 `error` 里记录 `hintUsed: true`。
- 如果当前 UI 暂时不记录 reveal/hint 状态，则第一版可以先不产出 `hinted`。

## 评估服务边界

建议新增服务：

```ts
class PracticeResponseEvaluationService {
    evaluate(input: {
        userId: string;
        practiceItemId: string;
        answer: PracticeAnswerPayload;
        now?: Date;
    }): Promise<PracticeEvaluationResult>;
}
```

返回：

```ts
type PracticeEvaluationResult = {
    response: UserResponse;
    evidence: LearningEvidence[];
    targetUpdates: LearningTarget[];
    feedback: PracticeUserFeedback;
};
```

服务职责：

- 加载 practice detail。
- 校验 practice item 属于该用户的 target。
- 选择 evaluator。
- 为每个 `PracticeItemTarget` 生成一条 `LearningEvidence`。
- 根据 evidence 计算 `LearningTarget` 更新。
- 调用 repository 在事务里写入 response、evidence、target update。

服务不应该：

- 直接操作 UI state。
- 让 LLM 直接写数据库。
- 把所有 target 简化成一个总分。
- 让 `UserResponse` 绕过 `LearningEvidence` 直接更新 `LearningTarget`。

## Evaluator 选择

第一版采用 LLM-required evaluator：

```text
PracticeItem.contextSnapshot.kind
-> build EvaluationContext
-> local preprocess only
-> call LLM structured evaluator for every non-empty answer
-> validate and normalize LLM output
-> generate LearningEvidence
```

推荐规则：

| Practice kind          | 第一版 evaluator      | 说明                                            |
| ---------------------- | --------------------- | ----------------------------------------------- |
| `expression_recall`    | LLM 结构化评估        | 即使目标是 expression，用户也可能用复杂语句回答 |
| `utterance_production` | LLM 结构化评估        | 需要判断意义、自然度、语域、遗漏和可接受变体    |
| 空答案                 | 本地短路为 `failed`   | 没有语义内容，不需要消耗 LLM                    |
| LLM 不可用             | `not_tested` fallback | 不应把本地粗判伪装成真实掌握证据                |

因此本地 evaluator 不再产出 `correct` / `partial` / `failed` 的正式判断，除非答案为空。本地 exact match 可以作为 `EvaluationContext.localSignals.exactMatch` 提供给 LLM，但最终 result 仍以 LLM structured output 为准。

## 本地预处理

本地逻辑需要一个稳定的 normalization，但它只服务于 prompt 构造、空答案判断和 LLM 输出校验，不作为掌握程度的最终来源：

```ts
type NormalizedAnswer = {
    raw: string;
    normalized: string;
    tokens: string[];
};
```

英文第一版规则：

- trim
- lowercase
- 折叠连续空白
- 去掉句尾 `.?!`
- 把 smart quotes 归一到普通 quote
- 可选：忽略大小写和末尾标点，但不忽略词序

不要在本地做过度纠错：

- 不自动接受完全不同表达。
- 不把拼写很远的答案判为正确。
- 不用模糊匹配替代语义判断。

## Expression Recall 评估

输入来自当前生成器：

```ts
PracticeItem {
    type: "free_response",
    contextSnapshot: {
        kind: "expression_recall"
    },
    expectedAnswer: {
        expressionId: string,
        text: string,
        normalizedText: string,
        language: string
    },
    acceptableAnswers: string[]
}
```

LLM 判断规则：

```text
answer naturally expresses the required expression in the target context
-> correct

answer uses a semantically close but incomplete or less natural wording
-> partial

answer includes the expected expression but the sentence around it is awkward or over-scoped
-> partial

answer is blank
-> local failed without LLM

answer conflicts with expected expression
-> failed
```

示例：

| Expected     | User answer                                             | Evidence           |
| ------------ | ------------------------------------------------------- | ------------------ |
| `bacon bits` | `Could I get extra bacon bits on my baked potato?`      | LLM 判断 `correct` |
| `bacon bits` | `Can you add some bacon pieces to the potato?`          | LLM 判断 `partial` |
| `bacon bits` | `I want the crispy bacon crumbs on top of that potato.` | LLM 判断 `partial` |
| `bacon bits` | `Could I get extra sour cream?`                         | LLM 判断 `failed`  |
| `bacon bits` | 空字符串                                                | 本地短路 `failed`  |

`LearningEvidence.error` 建议结构：

```ts
type ExpressionRecallError = {
    kind: "expression_recall";
    expected: string[];
    received: string;
    normalizedReceived: string;
    reason:
        | "blank"
        | "llm_accepted"
        | "llm_partial"
        | "wrong_expression"
        | "wrong_context"
        | "llm_unavailable";
};
```

注意：`error` 不是只给失败用。它可以保存结构化评估细节，用户可读反馈仍放在 `UserResponse.feedback`。

## Utterance Production 评估

输入来自当前生成器：

```ts
PracticeItem {
    type: "scenario_response",
    contextSnapshot: {
        kind: "utterance_production"
    },
    expectedAnswer: {
        utteranceId: string,
        text: string,
        language: string
    },
    acceptableAnswers: string[]
}
```

这类题评估的是：

> 用户能不能在给定场景中产出自然、完整、语用合适的表达？

本地预处理：

- 空答案 -> 本地短路为 `failed`
- exact normalized match -> 作为 `localSignals.exactMatch = true` 传给 LLM
- 包含全部 required expressions -> 作为 `localSignals.containsRequiredExpressions = true` 传给 LLM
- 缺少核心 required expression -> 作为 `localSignals.missingRequiredExpressionIds` 传给 LLM
- 最终 `correct` / `partial` / `failed` 必须来自 LLM structured output

LLM structured evaluator 输入：

```ts
type UtteranceEvaluationInput = {
    prompt: unknown;
    expectedAnswer: unknown;
    acceptableAnswers?: unknown;
    contextSnapshot?: Record<string, unknown>;
    userAnswer: string;
    localSignals: {
        exactMatch: boolean;
        containsRequiredExpressions: boolean;
        missingRequiredExpressionIds: string[];
        normalizedAnswer: string;
    };
    targetEntities: Array<{
        learningTargetId: string;
        ability: string;
        entities: Array<{
            entityType: string;
            entityId: string;
            role: string;
        }>;
    }>;
};
```

LLM structured evaluator 输出必须是窄结构：

```ts
type UtteranceEvaluationOutput = {
    result: "correct" | "partial" | "failed";
    confidence: number;
    feedbackSummary: string;
    issues: Array<{
        kind:
            | "missing_required_expression"
            | "wrong_meaning"
            | "wrong_register"
            | "unnatural_collocation"
            | "grammar"
            | "too_literal"
            | "incomplete";
        severity: "minor" | "major";
        note: string;
        relatedEntityId?: string;
    }>;
    acceptedAlternative?: string;
};
```

输出约束：

- 不允许 LLM 返回任意新 result。
- 不允许 LLM 更新 target。
- 不允许 LLM 新建 knowledge entity。
- LLM 必须为每个直接测试的 target 给出判断依据。
- `confidence` 低于阈值时，服务可以降级为 `partial` 或 `not_tested`。

## 多 Target Evidence 规则

一次 `PracticeItem` 可能关联多个 `LearningTarget`。评估时应为每个 target 产出 evidence，但不是每个 target 都应推进 mastery。

建议规则：

| target link                   | Evidence result                             | 是否更新 mastery |
| ----------------------------- | ------------------------------------------- | ---------------- |
| 直接测试，`weight >= 1`       | `correct` / `partial` / `failed` / `hinted` | 是               |
| 间接暴露，`0 < weight < 1`    | `exposed`                                   | 否               |
| 题目关联但 evaluator 无法判断 | `not_tested`                                | 否               |

第一版当前生成器通常每题只连一个 target，所以实现可以先简单，但服务接口要保留多 target 形状。

## LearningEvidence 生成

Evidence ID 使用确定性结构即可：

```text
evidence:{userResponseId}:{learningTargetId}
```

生成示例：

```ts
LearningEvidence {
    id: `evidence:${response.id}:${target.id}`,
    userResponseId: response.id,
    learningTargetId: target.id,
    result: "partial",
    confidence: 0.82,
    error: {
        kind: "utterance_production",
        issues: [
            {
                kind: "missing_required_expression",
                severity: "major",
                relatedEntityId: "<expression id>"
            }
        ]
    },
    createdAt: now
}
```

`confidence` 建议：

- 空答案本地短路：`1`
- LLM structured 判断：使用 LLM 输出，但 clamp 到 `0..1`
- LLM 输出 schema 无效：不写 `correct` / `partial` / `failed`，降级为 `not_tested`
- LLM 不可用 fallback：`0.3` 以下，并优先 `not_tested`

## 掌握程度更新

`LearningEvidence` 是事实记录，`LearningTarget` 是掌握状态。写入 evidence 后，需要用可解释的规则更新 target。

第一版继续沿用前一份 proposal 中的简单指数间隔模型：

```ts
const baseDays = {
    low: 2,
    medium: 1,
    high: 0.5,
};
```

只处理这些 result：

- `correct`
- `partial`
- `hinted`
- `failed`

不推进 mastery：

- `exposed`
- `not_tested`

建议更新规则：

| Evidence  | reviewCount | lapseCount | stability                               | dueAt                  |
| --------- | ----------- | ---------- | --------------------------------------- | ---------------------- |
| `correct` | `+1`        | 不变       | `base * 2 ** effectiveReview`           | `now + stability days` |
| `partial` | `+1`        | 不变       | `max(0.5, nextCorrectInterval * 0.5)`   | `now + stability days` |
| `hinted`  | `+1`        | 不变       | `max(0.25, nextCorrectInterval * 0.25)` | `now + stability days` |
| `failed`  | `+1`        | `+1`       | `base`                                  | `now + 0.25 days`      |

其中：

```ts
effectiveReview = Math.max(0, reviewCount - lapseCount);
```

`lastReviewedAt` 更新为 `now`，`updatedAt` 更新为 `now`。

第一版不建议自动把 `status` 改成 `mastered`。可以等稳定度阈值更可靠后再做，例如未来满足：

```text
stability >= 30 days
and recent failed count == 0
and reviewCount - lapseCount >= 5
```

## UI 中的“掌握程度”

如果界面需要显示“掌握程度”，建议先做派生展示，而不是新增数据库字段。

示例：

```ts
type MasteryViewState =
    "new" | "fragile" | "building" | "stable" | "ready_to_pause";
```

派生规则：

| 条件                                                  | UI 状态          |
| ----------------------------------------------------- | ---------------- |
| `reviewCount === 0`                                   | `new`            |
| 最近一次 `failed` 或 `lapseCount > 0 && dueAt <= now` | `fragile`        |
| `stability < 3`                                       | `building`       |
| `stability >= 3 && stability < 30`                    | `stable`         |
| `stability >= 30`                                     | `ready_to_pause` |

这个状态只用于展示，不作为 source of truth。真正的 source of truth 仍然是 `LearningEvidence` 历史和 `LearningTarget` 调度字段。

## Repository 调整

当前 `recordResponse()` 只写 response + evidence，不更新 target。建议新增一个事务方法：

```ts
type EvaluatedPracticeResponseDraft = {
    response: UserResponse;
    evidence: LearningEvidence[];
    targetUpdates: LearningTarget[];
};

class PracticeRepository {
    async recordEvaluatedResponse(
        draft: EvaluatedPracticeResponseDraft
    ): Promise<void>;
}
```

事务顺序：

```text
runWriteTransaction
-> insert user response
-> insert learning evidence rows
-> upsert updated learning targets
```

保留 `recordUnevaluatedResponse()` 作为 fallback 或 debug 入口，但 UI 的正式提交路径应调用 evaluation service。

## UI 调整

`src/app/practice/[practiceItemId].tsx` 的提交逻辑建议从：

```text
practice.recordUnevaluatedResponse(...)
```

改为：

```text
practiceEvaluationService.evaluate(...)
```

提交后：

- 展示 `UserResponse.feedback.summary`
- 展示每条 evidence 的 result 和 confidence
- 重新加载 practice detail，让 target 的 due/review 状态刷新

如果保留 “Show answer”：

- 增加本地 state：`answerRevealedBeforeSubmit`
- 用户提交时放进 `PracticeAnswerPayload.interaction`
- evaluator 用它决定是否产出 `hinted`

## 用户反馈结构

`UserResponse.feedback` 建议保存用户可读摘要：

```ts
type PracticeUserFeedback = {
    summary: string;
    result: "correct" | "partial" | "failed" | "hinted" | "not_tested";
    details?: Array<{
        title: string;
        message: string;
        severity: "info" | "warning" | "error";
    }>;
};
```

示例：

```ts
{
    result: "partial",
    summary: "Almost there. You used the right food context, but missed “bacon bits”.",
    details: [
        {
            title: "Missing expression",
            message: "Use “bacon bits” for 培根碎 in this restaurant context.",
            severity: "warning"
        }
    ]
}
```

不要把这份用户反馈当作 evidence source of truth。它是展示层摘要，source of truth 仍是 `LearningEvidence`。

## 实现顺序建议

1. 增加 answer normalization helper。
2. 增加 `PracticeAnswerEvaluationContextBuilder`，把 `PracticeItem`、target、expected answer、acceptable answers 和 local signals 组装成 LLM 输入。
3. 增加 `StructuredPracticeAnswerEvaluator`，强制通过 LLM 返回窄结构结果。
4. 增加 LLM 输出 schema validation 和 fallback：schema 无效或 LLM 不可用时产出 `not_tested`，不推进 mastery。
5. 增加 `LearningTargetUpdatePolicy`，输入 evidence + target，输出更新后的 target。
6. 增加 `PracticeResponseEvaluationService`，先支持 `expression_recall` 和 `utterance_production` 共用同一个 LLM evaluator。
7. 增加 `PracticeRepository.recordEvaluatedResponse()`。
8. 把 practice detail 页提交逻辑从 unevaluated 改成 evaluated。
9. UI 记录 `answerRevealedBeforeSubmit`，支持 `hinted`。

这样第一批功能直接闭环复杂语句评估，而不是先做短语本地评分。

## 测试计划

Unit tests：

- normalization：大小写、空白、句尾标点，只作为 local signal。
- non-empty answer 会调用 LLM evaluator。
- expression exact match 也会调用 LLM evaluator。
- LLM 返回 accepted variant -> `correct`。
- LLM 返回 missing required expression -> `partial` 或 `failed`。
- blank answer -> 本地 `failed`，不调用 LLM。
- LLM schema invalid -> `not_tested`，不推进 target。
- LLM unavailable -> `not_tested`，不推进 target。
- reveal 后 exact match -> `hinted`。
- `exposed` / `not_tested` 不更新 target。
- `correct` / `partial` / `hinted` / `failed` 更新 `dueAt`、`stability`、`reviewCount`、`lapseCount`。

Repository tests：

- `recordEvaluatedResponse()` 同一事务写入 response、evidence、target update。
- evidence 写入失败时 response 不应单独落库。
- target update 失败时 evidence 不应单独落库。

Integration tests：

- practice detail 提交答案后刷新出 evidence。
- complex sentence answer 会经过 LLM structured evaluator。
- LLM 判定正确后会把 target 推迟到未来 due。
- LLM 判定错误后会增加 lapse 并很快再次 due。
- show answer 后提交正确答案不会被算作 full correct。

## 暂不处理

- 新增 mastery score 字段。
- 自动 `mastered` 状态迁移。
- 人工改判。
- 多次提交同一个 practice item 的复杂策略。
- 语音答案。
- 图片/diagram 答案。
- Pattern transfer 的语义评分。
- FSRS。
- 服务端 evaluator queue。
