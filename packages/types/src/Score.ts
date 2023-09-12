import { HexString } from '@polkadot/util/types.js'
import type { IPublicIdentity } from './PublicIdentity.js'

export const SCORE_IDENTIFIER: number = 101
export const SCORE_PREFIX: string = 'score:cord:'

export enum ScoreType {
  overall = 'Overall',
  delivery = 'Delivery',
}
export enum EntryType {
  credit = 'Credit',
  debit = 'Debit',
}

export interface IJournalContent {
  entity: IPublicIdentity['address']
  uid: string
  tid: string
  collector: IPublicIdentity['address']
  requestor: IPublicIdentity['address']
  rating_type: ScoreType
  rating: number
  entry_type: EntryType
  count: number
}

export interface IRatingInput {
  journalContent: IJournalContent,
  hash:string,
  auth:string
}

export interface IJournal {
  identifier: string
  entry: IJournalContent
  digest: HexString
  entitySignature: string
}

export interface IJournalDetails {
  identifier: IJournal['identifier']
  entry: IJournal['entry']
  digest: IJournal['digest']
}

export interface IScoreAggregateDetails {
  entity: IJournalContent['entity']
  rating_type:ScoreType
  aggregate: {
    count: number
    score: number
  }
}
export interface IScoreAverageDetails {
  entity: IJournalContent['entity']
  rating_type: ScoreType
  average: {
    count: number
    score: number
  }
}
