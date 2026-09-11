/**
 * FEATURETRACE: Money codec at the Prisma boundary (server only)
 *
 * The database stores amounts as BigInt minor units; application code uses decimal numbers.
 * lib/prisma-client.ts installs two Prisma client extensions:
 *   - READS: a `result` extension replaces every money field with fromMinor(value), so records
 *     (including nested includes and records returned by create/update) carry decimals.
 *   - WRITES/FILTERS: a `query` extension runs encodeMoneyArgs() on every operation, turning
 *     numbers in `data`, `where`, `having`, nested writes and include/select filters on money
 *     fields into minor units.
 *
 * Rule: a JS `number` on a money field is a decimal amount; a `bigint` is already minor units
 * and passes through unchanged (so encoding is idempotent).
 *
 * NOT converted (by design, so TypeScript flags every use): aggregate/groupBy results
 * (`_sum`, `_avg`, `_min`, `_max` on money fields are bigint minor units — wrap them with
 * sumFromMinor()) and raw SQL ($queryRaw) results.
 */

import { Prisma } from '@prisma/client'
import { toMinor } from '@/lib/money'

type Plain = Record<string, unknown>

interface ModelInfo {
  money: Set<string>
  /** relation field → related model name */
  relations: Map<string, string>
}

function buildModelIndex(): Map<string, ModelInfo> {
  const index = new Map<string, ModelInfo>()
  for (const model of Prisma.dmmf.datamodel.models) {
    const info: ModelInfo = { money: new Set(), relations: new Map() }
    for (const field of model.fields) {
      // Every BigInt column in this schema is an amount (asserted in tests/unit/lib/money-codec.test.ts)
      if (field.kind === 'scalar' && field.type === 'BigInt') info.money.add(field.name)
      if (field.kind === 'object') info.relations.set(field.name, field.type)
    }
    index.set(model.name, info)
  }
  return index
}

const MODELS = buildModelIndex()

/** Money fields per model, from the schema (used by tests and the result extension check). */
export function moneyFieldsByModel(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [name, info] of MODELS) if (info.money.size > 0) out[name] = [...info.money].sort()
  return out
}

function isPlain(value: unknown): value is Plain {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** A money value in `data` or a filter: number → minor units, bigint/null/other untouched. */
function encodeAmount(value: unknown): unknown {
  return typeof value === 'number' ? toMinor(value) : value
}

const SCALAR_FILTER_KEYS = new Set(['equals', 'lt', 'lte', 'gt', 'gte'])
const SCALAR_LIST_FILTER_KEYS = new Set(['in', 'notIn'])

function encodeScalarFilter(filter: unknown): unknown {
  if (!isPlain(filter)) return encodeAmount(filter)
  const out: Plain = {}
  for (const [key, value] of Object.entries(filter)) {
    if (SCALAR_FILTER_KEYS.has(key)) out[key] = encodeAmount(value)
    else if (SCALAR_LIST_FILTER_KEYS.has(key)) out[key] = Array.isArray(value) ? value.map(encodeAmount) : value
    else if (key === 'not') out[key] = encodeScalarFilter(value)
    else out[key] = value
  }
  return out
}

const UPDATE_AMOUNT_KEYS = new Set(['set', 'increment', 'decrement']) // multiply/divide take factors

function encodeAmountWrite(value: unknown): unknown {
  if (!isPlain(value)) return encodeAmount(value)
  const out: Plain = {}
  for (const [key, v] of Object.entries(value)) out[key] = UPDATE_AMOUNT_KEYS.has(key) ? encodeAmount(v) : v
  return out
}

const LOGICAL_KEYS = new Set(['AND', 'OR', 'NOT'])
const RELATION_FILTER_KEYS = new Set(['some', 'every', 'none', 'is', 'isNot'])

export function encodeWhere(model: string, where: unknown): unknown {
  const info = MODELS.get(model)
  if (!info || !isPlain(where)) return where
  const out: Plain = {}
  for (const [key, value] of Object.entries(where)) {
    if (LOGICAL_KEYS.has(key)) {
      out[key] = Array.isArray(value) ? value.map((w) => encodeWhere(model, w)) : encodeWhere(model, value)
    } else if (info.money.has(key)) {
      out[key] = encodeScalarFilter(value)
    } else if (info.relations.has(key)) {
      out[key] = encodeRelationFilter(info.relations.get(key)!, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function encodeRelationFilter(related: string, filter: unknown): unknown {
  if (!isPlain(filter)) return filter
  const keys = Object.keys(filter)
  if (keys.length > 0 && keys.every((k) => RELATION_FILTER_KEYS.has(k))) {
    const out: Plain = {}
    for (const [key, value] of Object.entries(filter)) out[key] = encodeWhere(related, value)
    return out
  }
  // To-one relations also accept the related model's filter directly
  return encodeWhere(related, filter)
}

const mapOneOrMany = (value: unknown, fn: (v: unknown) => unknown) =>
  Array.isArray(value) ? value.map(fn) : fn(value)

export function encodeData(model: string, data: unknown): unknown {
  const info = MODELS.get(model)
  if (!info) return data
  if (Array.isArray(data)) return data.map((d) => encodeData(model, d))
  if (!isPlain(data)) return data
  const out: Plain = {}
  for (const [key, value] of Object.entries(data)) {
    if (info.money.has(key)) out[key] = encodeAmountWrite(value)
    else if (info.relations.has(key)) out[key] = encodeNestedWrite(info.relations.get(key)!, value)
    else out[key] = value
  }
  return out
}

/** {where?, data} pair used by nested update/updateMany. */
function encodeWhereData(related: string, value: unknown): unknown {
  if (!isPlain(value)) return value
  const keys = Object.keys(value)
  if (keys.includes('data') && keys.every((k) => k === 'where' || k === 'data')) {
    return {
      ...value,
      ...(value.where !== undefined && { where: encodeWhere(related, value.where) }),
      data: encodeData(related, value.data),
    }
  }
  // To-one nested update passes the data directly
  return encodeData(related, value)
}

function encodeNestedWrite(related: string, write: unknown): unknown {
  if (!isPlain(write)) return write
  const out: Plain = {}
  for (const [op, value] of Object.entries(write)) {
    switch (op) {
      case 'create':
        out[op] = encodeData(related, value)
        break
      case 'createMany':
        out[op] = isPlain(value) ? { ...value, data: encodeData(related, value.data) } : value
        break
      case 'connectOrCreate':
        out[op] = mapOneOrMany(value, (v) =>
          isPlain(v) ? { ...v, where: encodeWhere(related, v.where), create: encodeData(related, v.create) } : v
        )
        break
      case 'update':
      case 'updateMany':
        out[op] = mapOneOrMany(value, (v) => encodeWhereData(related, v))
        break
      case 'upsert':
        out[op] = mapOneOrMany(value, (v) =>
          isPlain(v)
            ? {
                ...v,
                ...(v.where !== undefined && { where: encodeWhere(related, v.where) }),
                create: encodeData(related, v.create),
                update: encodeData(related, v.update),
              }
            : v
        )
        break
      case 'connect':
      case 'disconnect':
      case 'set':
      case 'delete':
      case 'deleteMany':
        out[op] = mapOneOrMany(value, (v) => encodeWhere(related, v))
        break
      default:
        out[op] = value
    }
  }
  return out
}

/** include/select trees: relation entries may carry `where` filters on the related model. */
export function encodeSelection(model: string, selection: unknown): unknown {
  const info = MODELS.get(model)
  if (!info || !isPlain(selection)) return selection
  const out: Plain = {}
  for (const [key, value] of Object.entries(selection)) {
    if (key === '_count' && isPlain(value) && isPlain(value.select)) {
      const select: Plain = {}
      for (const [rel, v] of Object.entries(value.select)) {
        const related = info.relations.get(rel)
        select[rel] = related && isPlain(v) && v.where !== undefined ? { ...v, where: encodeWhere(related, v.where) } : v
      }
      out[key] = { ...value, select }
    } else if (info.relations.has(key) && isPlain(value)) {
      out[key] = encodeRelationArgs(info.relations.get(key)!, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function encodeRelationArgs(model: string, args: Plain): Plain {
  return {
    ...args,
    ...(args.where !== undefined && { where: encodeWhere(model, args.where) }),
    ...(args.include !== undefined && { include: encodeSelection(model, args.include) }),
    ...(args.select !== undefined && { select: encodeSelection(model, args.select) }),
  }
}

const AGGREGATE_KEYS = new Set(['_sum', '_avg', '_min', '_max'])

function encodeHaving(model: string, having: unknown): unknown {
  const info = MODELS.get(model)
  if (!info || !isPlain(having)) return having
  const out: Plain = {}
  for (const [key, value] of Object.entries(having)) {
    if (LOGICAL_KEYS.has(key)) {
      out[key] = Array.isArray(value) ? value.map((h) => encodeHaving(model, h)) : encodeHaving(model, value)
    } else if (info.money.has(key) && isPlain(value)) {
      // { _sum: { gt: 100 } } (aggregate filters) and/or a direct filter such as { gt: 100 }
      const aggregates: Plain = {}
      const direct: Plain = {}
      for (const [k, v] of Object.entries(value)) {
        if (AGGREGATE_KEYS.has(k)) aggregates[k] = encodeScalarFilter(v)
        else if (k === '_count') aggregates[k] = v
        else direct[k] = v
      }
      out[key] = { ...(encodeScalarFilter(direct) as Plain), ...aggregates }
    } else if (info.money.has(key)) {
      out[key] = encodeScalarFilter(value)
    } else {
      out[key] = value
    }
  }
  return out
}

/** Convert decimal amounts in any model operation's arguments to minor units. */
export function encodeMoneyArgs(model: string | undefined, _operation: string, args: unknown): unknown {
  if (!model || !MODELS.has(model) || !isPlain(args)) return args
  const out: Plain = { ...args }
  if (args.where !== undefined) out.where = encodeWhere(model, args.where)
  if (args.data !== undefined) out.data = encodeData(model, args.data)
  if (args.create !== undefined) out.create = encodeData(model, args.create) // upsert
  if (args.update !== undefined) out.update = encodeData(model, args.update) // upsert
  if (args.having !== undefined) out.having = encodeHaving(model, args.having)
  if (args.include !== undefined) out.include = encodeSelection(model, args.include)
  if (args.select !== undefined) out.select = encodeSelection(model, args.select)
  return out
}
