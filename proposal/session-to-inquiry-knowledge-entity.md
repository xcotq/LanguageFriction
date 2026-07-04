# 用户会话 -> Inquiry -> KnowledgeEntity 线性主流程提案

## 结论

当前阶段先实现线性的前台主流程，不上任务队列，不接服务端，不把 Pattern 放进
主流程。

目标流程：

```text
用户点击 End
-> 固化 Session
-> 运行 extraction workflow
-> 生成 Inquiry / KnowledgePoint / Concept / Expression / Relation 候选
-> 展示待写入内容给用户确认
-> 用户 Confirm
-> 单个事务落表
```

这个版本可以牺牲可用性：用户等待、失败重试、app 退出恢复都可以先简单处理。
但服务边界要写成未来可以搬进 queue worker 的形状：workflow 只负责从输入生成
preview，commit 只负责把 approved preview 原子写入数据库。

## 已读依据

本地依据：

- `docs/initial-domain-model.md`
- `src/types/domain.ts`
- `src/data/database/schema.ts`
- `src/data/repositories/knowledge.repository.ts`
- `src/app/index.tsx`
- `src/providers/language-model-provider.ts`

官方文档依据：

- Expo SDK v56: https://docs.expo.dev/versions/v56.0.0/
- Expo SQLite v56: https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/
- Vercel AI SDK Workflow Patterns:
  https://ai-sdk.dev/docs/agents/workflows
- Vercel AI SDK Structured Data:
  https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- Vercel AI SDK Tool Calling:
  https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Vercel AI SDK Loop Control: https://ai-sdk.dev/docs/agents/loop-control

AI SDK 文档支持用 workflow patterns 组织 sequential processing、routing、
parallel processing、evaluation loop；结构化输出可以通过 `generateText` 配合
`Output.object({ schema })` 完成。这里不需要引入 LangGraph 本身，先用普通
TypeScript 函数把 workflow 显式串起来。

## 当前实现观察

代码里的数据表已经覆盖主流程需要的大部分实体：

- 原始会话层：`sessions`、`messages`、`content_blocks`
- 后处理层：`inquiries`、`inquiry_messages`
- 知识层：`concepts`、`expressions`、`knowledge_points`、
  `knowledge_point_utterances`、`knowledge_point_entities`、`relations`

主流程暂时忽略：

- `patterns`
- `KnowledgePointEntity.entityType === "pattern"`
- `Relation.fromType/toType === "pattern"`
- LearningTarget 和 practice 相关实体

可复用的现有能力：

- `KnowledgeRepository.saveInquiryExtraction()` 已经能保存单个 inquiry 的
  extraction draft。
- `runWriteTransaction()` 已经提供 native exclusive transaction。
- `handleEndSession()` 是合适的前台入口。

需要补的能力：

- LLM service/provider 分层：当前 `sendLanguageFrictionMessage()` 直接调用
  `language-model-provider` 暴露的 `complete()`，这是不好的边界。
- structured output wrapper：`language-model-provider.ts` 当前
  `invokeStructured()` 会 throw。
- 一次确认写入多个 inquiries 的 repository 方法。
- Concept lookup：现在只有 expression exact lookup。
- preview 数据结构和 UI 状态。
- End 不应直接 archive；应先进入 `closed`。

## 领域边界决定

### End 与 Confirm 的边界

用户点击 End 后应立即固化原始 session：

- 停止该 session 接收新消息。
- 写入 `endedAt`。
- 将 `Session.status` 置为 `closed`。
- 基于完整会话生成 transcript snapshot。

这一步属于 raw layer 的会话生命周期，不等同于知识落表。用户确认前不写入
`Inquiry`、`KnowledgePoint`、`Concept`、`Expression` 或 `Relation`。

如果 extraction 失败，session 可以保持 `closed`，本阶段不追求优雅恢复。
如果用户不确认，session 也保持 `closed`，但没有 knowledge 写入。

### Pattern 不进入主流程

Pattern 是纯离线自动触发工作，不在 End -> Confirm 主流程内做：

- extractor 不生成 pattern candidates。
- preview 不展示 pattern。
- commit 不写 `patterns`。
- relation 不写 pattern 相关边。

将来可以由独立 offline induction worker 从已保存的 utterances、expressions 和
重复用户摩擦中归纳 pattern。

### LLM 不直接写库

LLM workflow 可以读取 transcript 和候选实体，但不能拥有写库工具。所有 mutation
都由应用代码在用户确认后执行。

## LLM 架构边界

本项目应明确拆分 LLM provider layer 和 LLM service layer。外部业务代码只依赖
LLM service；provider 只作为 service 内部实现细节存在。

### Provider Layer

Provider layer 负责“如何连接模型”：

- 读取 endpoint、api key、model name、temperature、timeout 等配置。
- 创建 AI SDK provider/model instance。
- 处理 provider-specific normalize、retry、timeout、call settings。
- 对外暴露已存在的模型状态、模型名、配置状态等 context 能力。

建议边界：

- `src/providers/language-model-provider.ts` 保留为 provider adapter。
- `src/providers/language-model-state.tsx` 可以继续给 UI 暴露
  `configured/modelName/label` 等状态。
- 除 LLM service 和模型状态/settings context 外，其他模块不应 import
  `@/providers/language-model-provider`。

也就是说，provider 可以有 `completeRaw()`、`invokeStructuredRaw()` 之类的底层
能力，但它们不应该被 UI、hooks、domain workflow 或 repository 直接调用。

### LLM Service Layer

LLM service layer 负责“业务需要什么 LLM 能力”：

```ts
type LanguageModelService = {
    chat(request: ChatCompletionRequest): Promise<string>;
    structuredOutput<Output extends Record<string, unknown>>(
        request: StructuredOutputRequest<Output>
    ): Promise<Output>;
    runWorkflow<Output extends Record<string, unknown>>(
        request: WorkflowRequest<Output>
    ): Promise<Output>;
};
```

其中：

- `chat` 服务普通对话回答，例如当前 `sendLanguageFrictionMessage()`。
- `structuredOutput` 服务结构化抽取、分类、校验等单步任务。
- `workflow` 服务多步 LLM 编排，例如 session extraction workflow。

Service 内部可以调用 provider 获取模型端点和 SDK model instance；外部不关心
endpoint、provider name、AI SDK 细节。

### 对当前代码的调整方向

当前：

```text
ChatScreen
-> sendLanguageFrictionMessage()
-> complete()
-> language-model-provider
```

建议改成：

```text
ChatScreen
-> LanguageModelService.chat()
-> provider adapter
```

session extraction 则是：

```text
ChatScreen / SessionFinalizationService
-> LanguageModelService.runWorkflow("sessionExtraction", input)
-> SessionExtractionWorkflow
-> LanguageModelService.structuredOutput(...)
-> provider adapter
```

如果实现上不想做字符串 workflow registry，也可以直接导出具体服务：

```text
languageModelChatService.send(...)
sessionExtractionWorkflow.run(...)
structuredOutputService.invoke(...)
```

但这些服务都位于 `src/services/llm/**` 或等价目录，且只有它们能 import
provider adapter。

### Import 约束

建议形成简单规则：

- `src/app/**` 不 import `@/providers/language-model-provider`。
- `src/hooks/**` 不 import `@/providers/language-model-provider`。
- `src/data/**` 不 import `@/providers/language-model-provider`。
- `src/services/**` 中只有 LLM service 子目录可以 import provider adapter。
- UI 可以继续通过状态 context 读取 model status/name，但不能直接发起 provider
  completion。

这条约束比文件命名更重要。它能避免 chat、structured output、workflow 三类能力
各自绕过 provider，后续也更容易替换模型供应商或把 workflow 搬进 worker。

## 线性 Workflow 设计

建议新增一个可搬迁的 workflow service：

```ts
type SessionExtractionWorkflow = {
    run(input: SessionExtractionInput): Promise<SessionExtractionPreview>;
};
```

它现在由 UI 前台调用；以后 queue worker 可以直接调用同一个 `run()`，再把
preview 存成 job output。

### Step 0. Build Transcript Snapshot

输入：

- `ChatSession`
- ordered `ChatMessage[]`
- ordered `ContentBlock[]`

输出：

```ts
type TranscriptSnapshot = {
    sessionId: string;
    userId: string;
    title?: string;
    startedAt: string;
    endedAt?: string;
    transcriptHash: string;
    messages: Array<{
        id: string;
        role: "user" | "assistant" | "system";
        sequence: number;
        createdAt: string;
        text: string;
        nonTextBlocks: Array<{
            type: "image" | "audio" | "diagram" | "structured";
            metadata?: Record<string, unknown>;
            sequence: number;
        }>;
    }>;
};
```

`transcriptHash` 用于 preview 和 commit 时校验用户确认的是同一份会话快照。

### Step 1. Segment Inquiries

使用 structured output 从完整 transcript 中切出 inquiries。它可以一次返回多个
inquiry，但只做分段和 source message 标注，不负责实体写入计划。

输出：

```ts
type InquirySlice = {
    tempId: string;
    title: string;
    userNeed: string;
    contextSummary: string;
    sourceLanguage?: string;
    targetLanguage: string;
    messageLinks: Array<{
        messageId: string;
        role:
            | "primary_question"
            | "clarification"
            | "answer"
            | "correction"
            | "supporting";
        sequence?: number;
    }>;
    confidence: number;
    reason: string;
};
```

如果没有有效 language friction，返回空数组。当前阶段可以简单展示“未抽取到可
保存内容”。

### Step 2. Draft Knowledge Per Inquiry

对每个 `InquirySlice` 生成该 inquiry 的知识草稿。可以先顺序执行，便于调试；
以后可以安全地改成 `Promise.all` 或 worker 分片。

输出：

```ts
type InquiryKnowledgeDraft = {
    inquiryTempId: string;
    knowledgePoint: {
        title: string;
        objective: string;
        contextSnapshot: Record<string, unknown>;
        explanation?: string;
    };
    utterances: Array<{
        text: string;
        language: string;
        role:
            | "recommended"
            | "alternative"
            | "contrast"
            | "incorrect"
            | "literal_translation";
        usageNote?: string;
    }>;
    conceptCandidates: Array<{
        tempRef: string;
        canonicalLabel: string;
        languageHint?: string;
        definition?: string;
        domain?: string[];
        aliases?: string[];
        disambiguationNote?: string;
        role: "primary" | "supporting" | "contrast" | "context";
        evidence: string[];
    }>;
    expressionCandidates: Array<{
        tempRef: string;
        text: string;
        language: string;
        normalizedText: string;
        partOfSpeech?: string;
        register?: string;
        region?: string;
        domain?: string[];
        meaningNote?: string;
        usageNote?: string;
        role: "primary" | "supporting" | "contrast" | "context";
        evidence: string[];
    }>;
    relationCandidates: Array<{
        fromTempRef: string;
        toTempRef: string;
        type:
            | "expresses"
            | "partially_expresses"
            | "ambiguous_with"
            | "used_with"
            | "part_of"
            | "is_a"
            | "contrast_with"
            | "confusable_with"
            | "variant_of"
            | "derived_from";
        direction: "directed" | "undirected";
        confidence: number;
        evidence: Record<string, unknown>;
    }>;
};
```

这里允许 LLM 生成 relation candidates，但应用代码仍要做白名单过滤和引用解析。

### Step 3. Resolve Entities

先做确定性解析，再视情况做 LLM-assisted judgment。

MVP 解析规则：

- Expression：按 `language + normalizedText` 查找。
- Concept：按 `canonicalLabel`、`aliases`、轻量 domain overlap 查找。
- 命中高置信现有实体则 `link_existing`。
- 没命中且 candidate 是 primary、contrast 或 retrieval-useful，则 `create_new`。
- 仅 supporting/context 且没有复习或检索价值的候选可以 `ignore`。

输出：

```ts
type EntityResolutionPreview = {
    tempRef: string;
    entityType: "concept" | "expression";
    decision: "link_existing" | "create_new" | "ignore";
    existingEntityId?: string;
    displayLabel: string;
    role: "primary" | "supporting" | "contrast" | "context";
    confidence: number;
    reason: string;
    draft?: Record<string, unknown>;
};
```

现阶段不做 `create_variant`，避免提前进入 merge/variant 复杂度。

### Step 4. Assemble Preview

workflow 最终只返回 preview，不写数据库。

```ts
type SessionExtractionPreview = {
    id: string;
    sessionId: string;
    userId: string;
    transcriptHash: string;
    generatedAt: string;
    inquiryPreviews: InquiryExtractionPreview[];
};

type InquiryExtractionPreview = {
    tempId: string;
    inquiry: {
        title: string;
        userNeed: string;
        contextSummary: string;
        sourceLanguage?: string;
        targetLanguage: string;
        messageLinks: InquirySlice["messageLinks"];
    };
    knowledgePoint: InquiryKnowledgeDraft["knowledgePoint"];
    utterances: InquiryKnowledgeDraft["utterances"];
    entities: EntityResolutionPreview[];
    relations: Array<{
        fromTempRef: string;
        toTempRef: string;
        type: string;
        direction: "directed" | "undirected";
        confidence: number;
        evidence: Record<string, unknown>;
    }>;
};
```

preview 可以先只存在 React state 中。未来上 job queue 时，可以把它作为
`ExtractionRun.outputJson` 或 job result 持久化。

## 用户确认与落表

### Preview UI 最小展示

不考虑可用性时，确认页只需要显示：

- 每个 inquiry 的 title、userNeed、contextSummary
- 将创建的 KnowledgePoint title/objective
- utterances
- entities：区分 `create_new`、`link_existing`、`ignore`
- relations：可先折叠或作为 debug 列表

用户操作：

- Confirm：执行 commit。
- Cancel：不写 knowledge，session 已 closed。

### Commit 输入

Confirm 后将 preview 转成正式 draft：

```ts
type ApprovedSessionExtraction = {
    sessionId: string;
    userId: string;
    transcriptHash: string;
    approvedAt: Date;
    inquiries: InquiryExtractionDraft[];
};
```

`InquiryExtractionDraft.patterns` 在此阶段始终为空。

### Commit 方法

建议新增 repository 方法，让一次确认的多个 inquiries 在同一个事务里写入：

```ts
class KnowledgeRepository {
    async saveSessionExtraction(
        extraction: ApprovedSessionExtraction
    ): Promise<void>;
}
```

内部复用现有 DAO，但不要对每个 inquiry 分别开启事务：

```text
runWriteTransaction
-> upsert inquiries
-> link inquiry messages
-> upsert concepts
-> upsert expressions
-> upsert knowledge points
-> upsert utterances
-> link knowledge point entities
-> upsert relations
```

这样可以满足“用户确认后事务落表”：要么整次确认全部成功，要么全部不写。

## ID 与幂等

虽然当前不上 queue，也要让 workflow 可以重跑。

建议：

- Preview ID: `preview:{sessionId}:{transcriptHash}`
- Inquiry ID: `inquiry:{sessionId}:{messageHash}:{index}`
- KnowledgePoint ID: `kp:{inquiryId}`
- Utterance ID: `utt:{knowledgePointId}:{role}:{normalizedTextHash}`
- Relation ID:
  `rel:{fromType}:{fromId}:{type}:{toType}:{toId}:{direction}`

Concept 和 Expression：

- 解析命中时使用已有 ID。
- 新建时可以使用 `concept:{normalizedLabelHash}` 和
  `expr:{language}:{normalizedTextHash}` 作为初始确定性 ID。
- 如果后续发现跨 domain 冲突，再引入 merge/variant 机制。

## 与未来 Queue Worker 的兼容

当前不实现 queue，但代码边界按 worker-friendly 方式设计：

```text
SessionFinalizationService.endSession(sessionId)
-> TranscriptSnapshotBuilder.build(session)
-> SessionExtractionWorkflow.run(snapshot)
-> UI preview
-> SessionExtractionCommitter.commit(approvedPreview)
```

未来 worker 化时只需要替换 orchestrator：

```text
ExtractionJobWorker
-> load closed session
-> build snapshot
-> SessionExtractionWorkflow.run(snapshot)
-> persist preview/result
-> wait user confirmation or auto-commit policy
```

因此当前版本不要把 workflow 逻辑写死在 React component 里；component 只负责调
用 service、保存 preview state、触发 confirm。

## AI SDK 使用方式

AI SDK 应被 LLM service 封装，而不是散落在业务代码里。建议：

1. provider adapter 只负责创建 AI SDK model 和执行底层调用。
2. LLM service 暴露 `chat`、`structuredOutput`、`workflow`。
3. workflow 内部只调用 LLM service，不直接访问 provider。

示意：

```ts
type StructuredModel<Output extends Record<string, unknown>> = {
    invoke(input: CompletionInput): Promise<Output>;
};

async function invokeStructured<Output extends Record<string, unknown>>(
    input: CompletionInput,
    schema: StructuredOutputSchema,
    options?: StructuredOutputOptions
): Promise<Output>;
```

如果使用 Zod schema，应把 `zod` 加为直接 dependency，而不是依赖 transitive
dependency。也可以先用 JSON Schema，减少依赖变化。

工作流内部建议使用普通 TypeScript 组合：

```text
segmentInquiries(snapshot)
-> for each inquiry: draftKnowledgeForInquiry(snapshot, inquiry)
-> resolveEntities(drafts)
-> assemblePreview(snapshot, slices, drafts, resolutions)
```

需要 routing 或 evaluation loop 时再加：

- routing：区分 single-inquiry、multi-inquiry、no-friction。
- evaluation loop：检查 output 是否缺 message links、是否生成 pattern、是否有
  unsupported relation。
- parallel processing：多个 inquiry 的 `draftKnowledgeForInquiry` 可并行。

第一版推荐先用 sequential workflow，方便调试和对照数据库结果。

## 实体与 Relation 规则

### Concept

创建条件：

- 用户明确提到。
- 是 inquiry 的 primary subject。
- 对未来检索或复习有价值。
- 对 distinction/contrast 有必要。

不要创建：

- assistant 解释里顺手提到的背景概念。
- 只出现一次且不影响表达学习的上下文名词。

### Expression

创建条件：

- 是推荐表达或核心短语。
- 是需要区分、纠正或记忆的表达。
- 有明确 language 和 normalizedText。

### KnowledgePointEntity

只链接 concept 和 expression：

- primary：核心学习对象。
- supporting：有助于理解，但不是主要训练对象。
- contrast：用于区分。
- context：只提供场景约束。
- derived：由 inquiry 推导出的表达或概念。

### Relation

第一版只允许这些 relation：

- Expression -> Concept: `expresses`、`partially_expresses`、
  `ambiguous_with`
- Concept -> Concept: `used_with`、`part_of`、`is_a`、`contrast_with`、
  `confusable_with`
- Expression -> Expression: `variant_of`、`contrast_with`、
  `confusable_with`
- KnowledgePoint -> Concept/Expression: 可以不用 relation，优先用
  `KnowledgePointEntity`
- KnowledgePoint -> KnowledgePoint: 暂不做

`related_in_context` 暂不生成。

## 数据模型影响

当前线性主流程不需要新增持久化实体，因此暂不需要修改
`docs/initial-domain-model.md`。

需要注意：

- 如果将 preview 持久化为 `ExtractionPreview` 或 `ExtractionRun`，那时才需要
  更新领域模型文档。
- 如果引入 queue 的 `ExtractionJob`，也需要先更新领域模型文档。
- Pattern 主流程忽略，但模型文档中的 Pattern 保持不变，供未来离线 induction
  使用。

## 实现顺序建议

1. 拆分 LLM service/provider 边界：
    - 把当前 `sendLanguageFrictionMessage()` 迁到 LLM chat service。
    - UI 只调用 LLM service，不直接 import provider。
    - provider 继续负责 endpoint、model instance、settings/status。
2. 在 LLM service 中补 structured output：
    - 底层使用 provider adapter。
    - 对外暴露 `structuredOutput(...)`。
3. `ChatSessionRepository.closeSession(sessionId)`：替换 End 直接 archive。
4. `TranscriptSnapshotBuilder`：从 `ChatSession` 生成 stable snapshot。
5. `SessionExtractionWorkflow`：
    - `segmentInquiries`
    - `draftKnowledgeForInquiry`
    - `resolveEntities`
    - `assemblePreview`
6. `KnowledgeRepository.saveSessionExtraction(...)`：一次确认一个事务写入多个
   drafts。
7. `ChatScreen` 增加 preview state：
    - End -> run workflow
    - 展示 preview
    - Confirm -> commit
8. 测试核心 parser、resolver、commit transaction 和 provider import 边界。

## 测试计划

Unit tests：

- LLM service 调用 provider adapter，但 app/hooks/data 不直接 import provider
- transcript snapshot 排序和 hash 稳定性
- structured output schema validation
- no-pattern guard
- expression exact resolution
- concept label/alias resolution
- relation whitelist filtering
- preview -> approved draft 转换

Repository tests：

- `saveSessionExtraction()` 多 inquiry 同事务成功写入
- 任一 draft 失败时整次事务回滚
- 重复 confirm 同一 preview 不产生重复 relation

Integration tests：

- End 后 session 变 `closed`
- End 后生成 preview，但确认前不写 inquiries/knowledge
- Confirm 后写入 inquiry、message links、knowledge point、utterances、
  concepts、expressions、knowledge point entities、relations
- Pattern 不被写入

## 暂不处理

- durable extraction job queue
- Expo BackgroundTask
- server-assisted extraction
- Pattern induction
- LearningTarget 自动创建
- practice generation
- 高级 merge/variant 流程
- 用户细粒度编辑 preview
