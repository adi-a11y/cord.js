import { SCORE_MODULUS, IJournalContent } from '@cord.network/types'
import { Crypto } from '@cord.network/utils'
import {
  HexString,
  SCORE_IDENT,
  SCORE_PREFIX,
  ScoreType,
  IScoreAverageDetails,
} from '@cord.network/types'
import { Identifier } from '@cord.network/utils'
import { ConfigService } from '@cord.network/config'
import type { H256 } from '@polkadot/types/interfaces'
import { getHashRoot } from '../document/Document'
import { fetchScore } from './Scoring.chain'

export function adjustAndRoundRating(rating: number): number {
  rating = Math.round(rating * SCORE_MODULUS)
  return rating
}

export function ComputeActualRating(rating: number): number {
  return rating / SCORE_MODULUS
}

export function ComputeAverageRating(rating: number, count: number): number {
  return rating / count
}

export function generateRootHashFromContent(journalContent: IJournalContent) {
  const hashes = []
  hashes.push(Crypto.coToUInt8(journalContent.entity))
  hashes.push(Crypto.coToUInt8(journalContent.tid))
  hashes.push(Crypto.coToUInt8(journalContent.collector))
  hashes.push(Crypto.coToUInt8(journalContent.rating_type))
  hashes.push(Crypto.coToUInt8(journalContent.rating.toString()))
  hashes.push(Crypto.coToUInt8(journalContent.entry_type))
  hashes.push(Crypto.coToUInt8(journalContent.count.toString()))
  const root = getHashRoot(hashes)
  const digest = Crypto.u8aToHex(root)
  return digest
}

export function getUriForScore(scoreDigest: HexString) {
  const api = ConfigService.get('api')
  const scaleEncodedDigest = api.createType<H256>('H256', scoreDigest).toU8a()
  return Identifier.hashToUri(scaleEncodedDigest, SCORE_IDENT, SCORE_PREFIX)
}

export async function fetchAverageScore(
  entityUri: string,
  scoreType: ScoreType
): Promise<IScoreAverageDetails> {
  const pertialEntityUri = entityUri.split('did:cord:').join('')
  const decodedScoreEntry = await fetchScore(pertialEntityUri, scoreType)

  const actualRating = ComputeActualRating(decodedScoreEntry.rating)
  const averageRating = ComputeAverageRating(
    actualRating,
    decodedScoreEntry.count
  )
  return {
    rating: actualRating,
    count: decodedScoreEntry.count,
    average: averageRating,
  }
}
