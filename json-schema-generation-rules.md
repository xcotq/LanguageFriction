# JSON Schema 生成规则

生成 `json_schema` 时，顶层使用 `object`；所有字段写入 `properties` 和 `required`；可选值用 `["类型", "null"]` 表示；每个对象设置 `additionalProperties: false`；开启 `strict: true`，避免使用未支持关键字。
