# KnowledgePoint -> LearningTarget -> PracticeItem 提案

## 结论

当前阶段不需要引入服务端、任务队列或新的持久化实体。已有领域模型中的
`LearningTarget`、`LearningTargetEntity`、`PracticeItem`、`PracticeItemTarget` 已经足够承接第一版。

第一版只处理两类训练对象：

- `KnowledgePointEntity.entityType === "expression"`：训练用户是否知道某个组成点怎么表达。
- `KnowledgePointUtterance`：训练用户是否知道这个 Inquiry 的整体表达。

当前假设：

- 一个 `KnowledgePoint` 只有一个主要 `KnowledgePointUtterance`。
- 不处理 `concept`、`pattern`、`transfer`、`distinction`。
- `KnowledgePoint -> LearningTarget` 和 `LearningTarget -> PracticeItem` 都由用户点击触发。
- 练习展示界面暂不做；本阶段只做到数据层生成和保存。

推荐第一版采用“显式两步路径”：

```text
KnowledgePoint detail
-> 用户点击生成 LearningTarget
-> 写入 expression recall target + utterance contextual_production target
-> 用户点击生成 PracticeItem
-> 按 dueAt / mastery / priority 选择 target
-> 写入 PracticeItem + PracticeItemTarget
```

同时保留一个“一键惰性路径”作为更快 MVP 或后续快捷入口：

```text
KnowledgePoint detail
-> 用户点击生成练习
-> 自动补齐缺失 LearningTarget
-> 立即为可练习 target 写入 PracticeItem
```

## 已读依据

- `docs/initial-domain-model.md`
- `src/types/domain.ts`
- `src/data/repositories/knowledge.repository.ts`
- `src/data/repositories/practice.repository.ts`
- `src/data/dao/learning.dao.ts`
- `proposal/session-to-inquiry-knowledge-entity.md`

## 当前模型判断

`docs/initial-domain-model.md` 已经定义：

- `LearningTarget` 是用户对某个训练对象的掌握状态。
- `LearningTargetEntity` 可以链接 `expression` 和 `utterance`。
- `PracticeItem` 是一次具体练习。
- `PracticeItemTarget` 可以把一个练习关联到一个或多个目标。

因此第一版不需要新增表，也暂不需要修改 `docs/initial-domain-model.md`。

需要补的是数据层能力：

- 从 `KnowledgePoint` 加载可训练 source：`KnowledgePoint`、唯一 utterance、关联 expressions。
- 从 `KnowledgePoint` 幂等生成 `LearningTarget`。
- 从 `LearningTarget` 幂等或批量生成 `PracticeItem`。
- 查询某个 `KnowledgePoint` 已有的 targets 和 practice items。

## 新增知识展示界面

因为用户需要点击 `KnowledgePoint` 来生成练习，所以需要一个知识展示入口。这个界面只负责触发数据生成，不需要做练习展示。

建议路由：

```text
/knowledge
/knowledge/[knowledgePointId]
```

### Knowledge 列表

第一版按 `KnowledgePoint` 展示，不直接按全局 `Expression` 展示。

列表项展示：

- `KnowledgePoint.title`
- `KnowledgePoint.objective`
- 推荐 utterance 摘要
- expression 数量
- 已生成 LearningTarget 数量
- 可练习 PracticeItem 数量或最近生成时间

数据来源需要通过 `Inquiry -> Session` 过滤 `userId`，因为 `KnowledgePoint` 本身没有 `userId`。

### KnowledgePoint 详情

详情页展示：

- 用户原始需求：来自 `KnowledgePoint.objective` 或关联 `Inquiry.userNeed`
- 场景上下文：`KnowledgePoint.contextSnapshot`
- 唯一推荐 utterance：`KnowledgePointUtterance`
- expression 列表：来自 `KnowledgePointEntity` 中的 expression links，再 hydrate `Expression`

操作区：

- `Generate targets`：触发 `KnowledgePoint -> LearningTarget`
- `Generate practice data`：触发 `LearningTarget -> PracticeItem`

生成后只显示结果计数和状态，例如：

```text
2 targets generated
2 practice items generated
```

练习作答界面留到下一阶段。

## 转换对象

### KnowledgePointPracticeSource

建议数据层先归一化成一个 source 对象，再做 target/practice 生成。

```ts
type KnowledgePointPracticeSource = {
    knowledgePoint: KnowledgePoint;
    inquiry: Inquiry;
    utterance: KnowledgePointUtterance;
    expressions: Array<{
        expression: Expression;
        link: KnowledgePointEntity;
    }>;
};
```

第一版过滤规则：

- utterance：优先取 `role === "recommended"`，否则取第一条。
- expression：只取 `KnowledgePointEntity.entityType === "expression"`。
- expression role：优先 `primary`、`derived`、`supporting`；`context` 默认不生成 target。
- 没有 utterance 时，不生成 utterance target。
- 没有 expression 时，仍可生成 utterance target。

## Path A：显式两步路径

这是推荐路径。

### Step A1. KnowledgePoint -> LearningTarget

用户在 `KnowledgePoint` 详情页点击 `Generate targets`。

数据层执行：

```text
load KnowledgePointPracticeSource
-> build expression recall targets
-> build utterance contextual production target
-> upsert LearningTarget
-> upsert LearningTargetEntity links
```

### Expression Target

每个可训练 expression 生成一个 recall target。

```ts
LearningTarget {
    id: `lt:kp:${knowledgePointId}:expr:${expressionId}:recall`
    userId
    knowledgePointId
    ability: "recall"
    status: "active"
    priority: expressionPriority(link.role)
    difficulty: inferExpressionDifficulty(expression)
    stability: initialStability(difficulty)
    dueAt: now
    reviewCount: 0
    lapseCount: 0
    schedulingAlgorithm: "lf-exponential"
    schedulingVersion: "0.1"
}

LearningTargetEntity {
    learningTargetId
    entityType: "expression"
    entityId: expression.id
    role: "primary"
}
```

如果需要保留上下文，可以额外链接 utterance：

```ts
LearningTargetEntity {
    learningTargetId
    entityType: "utterance"
    entityId: utterance.id
    role: "supporting"
}
```

这个 target 回答的问题是：

> 用户知不知道这个组成点怎么表达？

例如：`bacon bits`、`baked potato`、`on the side`。

### Utterance Target

每个 `KnowledgePoint` 第一版只生成一个 utterance target。

```ts
LearningTarget {
    id: `lt:kp:${knowledgePointId}:utt:${utteranceId}:contextual_production`
    userId
    knowledgePointId
    ability: "contextual_production"
    status: "active"
    priority: 90
    difficulty: inferUtteranceDifficulty(utterance)
    stability: initialStability(difficulty)
    dueAt: now
    reviewCount: 0
    lapseCount: 0
    schedulingAlgorithm: "lf-exponential"
    schedulingVersion: "0.1"
}

LearningTargetEntity {
    learningTargetId
    entityType: "utterance"
    entityId: utterance.id
    role: "primary"
}
```

并把组成表达作为 required links：

```ts
LearningTargetEntity {
    learningTargetId
    entityType: "expression"
    entityId: expression.id
    role: "required"
}
```

这个 target 回答的问题是：

> 用户知不知道之前提问的整体怎么表达？

例如：`Could I get extra bacon bits on my baked potato?`

### Step A2. LearningTarget -> PracticeItem

用户点击 `Generate practice data`。

数据层执行：

```text
load active LearningTargets for knowledgePointId + userId
-> filter by mastery and scheduling
-> materialize due targets into PracticeItem
-> write PracticeItem + PracticeItemTarget
```

第一版选择规则：

- `status !== "active"`：不生成。
- `dueAt == null`：视为 due。
- `dueAt <= now`：优先生成。
- `dueAt > now`：默认不生成，除非用户显式选择 extra practice。
- `priority` 高的先生成。
- 每次点击最多生成 1 个 expression item + 1 个 utterance item，避免刷出太多重复练习。

## Path B：一键惰性路径

这个路径适合更快的 MVP。

用户在 `KnowledgePoint` 详情页只看到一个按钮：

```text
Generate practice data
```

数据层执行：

```text
load KnowledgePointPracticeSource
-> upsert missing LearningTargets
-> load active targets
-> select due targets
-> generate PracticeItems
```

优点：

- UI 简单。
- 用户只关心“给我练习”，不需要理解 target。
- `LearningTarget` 仍然持久化，后续可以补 target 管理界面。

缺点：

- target 创建对用户不可见。
- 如果生成逻辑不幂等，容易重复 target。
- debug 时较难区分“目标生成失败”和“练习生成失败”。

为了控制风险，Path B 必须使用确定性 target ID 和 practice dedupe key。

## PracticeItem 生成规则

### Expression Recall PracticeItem

用于 expression target。

推荐类型：

```ts
PracticeItem.type = "free_response"
```

prompt snapshot：

```ts
{
    kind: "expression_recall",
    instruction: "How would you express this part in the target language?",
    sourceNeed: inquiry.userNeed,
    context: knowledgePoint.contextSnapshot,
    clue: expression.meaningNote ?? expression.usageNote ?? knowledgePoint.objective,
    targetLanguage: expression.language
}
```

expected answer：

```ts
{
    expressionId: expression.id,
    text: expression.text,
    normalizedText: expression.normalizedText,
    language: expression.language
}
```

acceptable answers：

```ts
[
    expression.text,
    expression.normalizedText
]
```

target link：

```ts
PracticeItemTarget {
    practiceItemId
    learningTargetId: expressionTarget.id
    weight: 1
}
```

### Utterance Production PracticeItem

用于 utterance target。

推荐类型：

```ts
PracticeItem.type = "scenario_response"
```

prompt snapshot：

```ts
{
    kind: "utterance_production",
    instruction: "Produce the full expression for this situation.",
    sourceNeed: inquiry.userNeed,
    objective: knowledgePoint.objective,
    context: knowledgePoint.contextSnapshot,
    targetLanguage: utterance.language,
    requiredExpressionIds: expressions.map(expression => expression.id)
}
```

expected answer：

```ts
{
    utteranceId: utterance.id,
    text: utterance.text,
    language: utterance.language
}
```

acceptable answers：

```ts
[
    utterance.text
]
```

target links：

```ts
PracticeItemTarget {
    practiceItemId
    learningTargetId: utteranceTarget.id
    weight: 1
}
```

可选：如果这个整体练习也间接暴露组成表达，可以关联 expression targets：

```ts
PracticeItemTarget {
    practiceItemId
    learningTargetId: expressionTarget.id
    weight: 0.25
}
```

第一版建议先只链接 utterance target，避免评估时把一个整体错误同时污染多个 expression target。

## 掌握程度与简单间隔算法

本阶段使用非常简单的指数增长算法。

### 初始值

```ts
const initialIntervalDays = {
    low: 2,
    medium: 1,
    high: 0.5,
};
```

`LearningTarget` 创建时：

- `reviewCount = 0`
- `lapseCount = 0`
- `stability = initialIntervalDays[difficulty]`
- `dueAt = now`

这样用户刚生成 target 后可以立刻生成练习。

### 难度估算

Expression：

```text
1 token, short text -> low
2-4 tokens -> medium
5+ tokens or contains punctuation/slot-like wording -> high
```

Utterance：

```text
<= 8 words -> medium
> 8 words -> high
```

没有足够信息时默认 `medium`。

### 生成 PracticeItem 时如何考虑掌握程度

PracticeItem 生成不更新掌握程度，只读取它。

规则：

- `mastered`：默认不生成。
- `paused` / `archived`：不生成。
- `active` 且 `dueAt <= now`：生成。
- `active` 且 `dueAt > now`：默认不生成；如果用户点击 extra practice，可以生成但不改变 `dueAt`。
- `lapseCount` 越高，越优先生成。
- `priority` 越高，越优先生成。

排序建议：

```text
dueAt asc
lapseCount desc
priority desc
reviewCount asc
```

### 回答后的未来更新

虽然本阶段不做练习展示界面，但数据层应预留更新逻辑。

当未来有 `UserResponse -> LearningEvidence` 后，更新 `LearningTarget`：

```ts
effectiveReview = Math.max(0, reviewCount - lapseCount)
nextIntervalDays = baseDays[difficulty] * 2 ** effectiveReview
```

结果映射：

- `correct`
  - `reviewCount += 1`
  - `stability = nextIntervalDays`
  - `dueAt = now + nextIntervalDays`
- `partial`
  - `reviewCount += 1`
  - `stability = max(0.5, nextIntervalDays * 0.5)`
  - `dueAt = now + stability`
- `hinted`
  - `reviewCount += 1`
  - `stability = max(0.25, nextIntervalDays * 0.25)`
  - `dueAt = now + stability`
- `failed`
  - `reviewCount += 1`
  - `lapseCount += 1`
  - `stability = baseDays[difficulty]`
  - `dueAt = now + 0.25 days`

`exposed` 和 `not_tested` 不应推进 mastery。

## 数据层服务建议

### KnowledgePracticeSourceService

职责：从 KnowledgePoint 组装练习生成所需数据。

```ts
class KnowledgePracticeSourceService {
    getSource(knowledgePointId: string, userId: string): Promise<KnowledgePointPracticeSource | null>
    listKnowledgePoints(userId: string): Promise<KnowledgePointSummary[]>
}
```

注意：

- 需要通过 `KnowledgePoint -> Inquiry -> Session` 校验 `userId`。
- 需要 hydrate expression 实体，而不是只返回 `KnowledgePointEntity` link。
- 如果一个 KnowledgePoint 多条 utterance，第一版只取 recommended/第一条，但类型上可以返回数组以便未来扩展。

### LearningTargetGenerationService

职责：从 KnowledgePoint source 幂等创建 targets。

```ts
class LearningTargetGenerationService {
    generateForKnowledgePoint(input: {
        userId: string;
        knowledgePointId: string;
        now?: Date;
    }): Promise<{
        targets: LearningTarget[];
        entities: LearningTargetEntity[];
    }>
}
```

写入可以复用 `PracticeRepository.saveLearningTarget()`，但建议补一个批量事务方法：

```ts
PracticeRepository.saveLearningTargets(
    drafts: Array<{
        target: LearningTarget;
        entities: LearningTargetEntity[];
    }>
): Promise<void>
```

### PracticeItemGenerationService

职责：从 LearningTarget 生成 practice data。

```ts
class PracticeItemGenerationService {
    generateForKnowledgePoint(input: {
        userId: string;
        knowledgePointId: string;
        now?: Date;
        allowEarlyPractice?: boolean;
        limit?: number;
    }): Promise<PracticeItemDraft[]>
}
```

需要补的 repository 查询：

```ts
PracticeRepository.listLearningTargetsForKnowledgePoint(
    userId: string,
    knowledgePointId: string
): Promise<Array<{
    target: LearningTarget;
    entities: LearningTargetEntity[];
}>>
```

也建议补批量保存：

```ts
PracticeRepository.savePracticeItems(drafts: PracticeItemDraft[]): Promise<void>
```

## ID 与幂等

LearningTarget ID 必须确定性生成：

```text
lt:kp:{knowledgePointId}:expr:{expressionId}:recall
lt:kp:{knowledgePointId}:utt:{utteranceId}:contextual_production
```

PracticeItem ID 可以确定性，也可以每次点击生成新 item。第一版建议带生成时间，允许用户多次生成练习：

```text
pi:{learningTargetId}:{practiceType}:{yyyyMMddHHmmss}
```

如果希望同一轮点击幂等，可以引入 request id：

```text
pi:{learningTargetId}:{practiceType}:{requestId}
```

不建议为 PracticeItem 用完全固定 ID，否则用户重复点击时会覆盖旧 item，难以追踪用户到底练了几次。

## 两条路径对比

| 路径 | 做法 | 优点 | 缺点 | 建议 |
| --- | --- | --- | --- | --- |
| Path A 显式两步 | 先生成 targets，再生成 practice items | 数据语义清楚，便于 debug，后续可加 target 管理 | UI 多一个动作 | 推荐 |
| Path B 一键惰性 | 点击生成练习时自动补 targets | 用户路径短，MVP 快 | target 创建隐式，失败原因较难展示 | 可作为快捷入口 |

## UI 与数据边界

本阶段 UI 只需要：

- 展示 KnowledgePoint。
- 展示 utterance 和 expressions。
- 提供两个按钮或一个快捷按钮。
- 显示生成结果。

本阶段 UI 不需要：

- 展示具体 PracticeItem。
- 允许用户作答。
- 生成 UserResponse。
- 更新 LearningEvidence。
- 更新 LearningTarget mastery。

数据层可以先完整生成 PracticeItem，因为后续练习界面只需要消费已经存在的 practice data。

## 实现顺序建议

1. 增加 Knowledge list/detail 数据查询能力。
2. 增加 KnowledgePoint 详情页，只展示 `KnowledgePoint`、utterance、expressions。
3. 增加 `LearningTargetGenerationService`。
4. 增加 `PracticeItemGenerationService`。
5. 在详情页接两个按钮：
   - Generate targets
   - Generate practice data
6. 用本地 deterministic templates 生成 `PracticeItem.prompt`。
7. 后续再做 practice 展示和 UserResponse / LearningEvidence。

## 暂不处理

- Pattern target。
- Concept target。
- 多 utterance 的 target 分裂。
- LLM 生成练习题文案。
- 服务端生成。
- 任务队列。
- 自动定时生成 due practice。
- practice 作答 UI。
- mastery 更新 UI。
- 复杂间隔算法或 FSRS。
