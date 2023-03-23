import {
  isDidSignature,
  verifyDidSignature,
  resolveKey,
  signatureToJson,
  signatureFromJson,
} from '@cord.network/did'
import type {
  DidResolveKey,
  Hash,
  IDocument,
  IStream,
  IContent,
  IDocumentPresentation,
  ISchema,
  SignCallback,
  IRegistryAuthorization,
} from '@cord.network/types'
import { Crypto, SDKErrors, DataUtils } from '@cord.network/utils'
import * as Content from '../content/index.js'
import { hashContents } from '../content/index.js'

import { verifyContentAganistSchema } from '../schema/Schema.js'
import { STREAM_IDENTIFIER, STREAM_PREFIX } from '@cord.network/types'
import { Identifier } from '@cord.network/utils'

function getHashRoot(leaves: Uint8Array[]): Uint8Array {
  const result = Crypto.u8aConcat(...leaves)
  return Crypto.hash(result)
}

function getHashLeaves(
  contentHashes: Hash[],
  evidenceIds: IDocument[]
): Uint8Array[] {
  const result = contentHashes.map((item) => Crypto.coToUInt8(item))

  if (evidenceIds) {
    evidenceIds.forEach((evidence) => {
      result.push(Crypto.coToUInt8(evidence.identifier))
    })
  }
  return result
}

/**
 * Calculates the root hash of the document.
 *
 * @param document The document object.
 * @returns The document hash.
 */

export function calculateDocumentHash(document: Partial<IDocument>): Hash {
  const hashes = getHashLeaves(
    document.contentHashes || [],
    document.evidenceIds || []
  )
  const root = getHashRoot(hashes)
  return Crypto.u8aToHex(root)
}

/**
 * Removes [[Content] properties from the [[Document]] object, provides anonymity and security when building the [[createPresentation]] method.
 *
 * @param document - The document object to remove properties from.
 * @param properties - Properties to remove from the [[Content]] object.
 * @returns A cloned Document with removed properties.
 */
export function removeContentProperties(
  document: IDocument,
  properties: string[]
): IDocument {
  const presentation: IDocument =
    // clone the credential because properties will be deleted later.
    // TODO: find a nice way to clone stuff
    JSON.parse(JSON.stringify(document))

  properties.forEach((key) => {
    delete presentation.content.contents[key]
  })
  presentation.contentNonceMap = hashContents(presentation.content, {
    nonces: presentation.contentNonceMap,
  }).nonceMap

  return presentation
}

/**
 * Prepares credential data for signing.
 *
 * @param input - The Stream to prepare the data for.
 * @param challenge - An optional challenge to be included in the signing process.
 * @returns The prepared signing data as Uint8Array.
 */
export function makeSigningData(
  input: IDocument,
  challenge?: string
): Uint8Array {
  return new Uint8Array([
    ...Crypto.coToUInt8(input.documentHash),
    ...Crypto.coToUInt8(challenge),
  ])
}

export function verifyDocumentHash(input: IDocument): void {
  if (input.documentHash !== calculateDocumentHash(input))
    throw new SDKErrors.RootHashUnverifiableError()
}

/**
 * Verifies the data of the [[ContentStream]] object; used to check that the data was not tampered with, by checking the data against hashes.
 *
 * @param input - The [[Stream]] for which to verify data.
 */

export function verifyDataIntegrity(input: IDocument): void {
  // check document hash
  verifyDocumentHash(input)

  // verify properties against selective disclosure proof
  Content.verifyDisclosedAttributes(input.content, {
    nonces: input.contentNonceMap,
    hashes: input.contentHashes,
  })

  // check evidences
  input.evidenceIds.forEach(verifyDataIntegrity)
}

/**
 *  Checks whether the input meets all the required criteria of an IDocument object.
 *  Throws on invalid input.
 *
 * @param input - A potentially only partial [[IDocument]].
 *
 */
export function verifyDataStructure(input: IDocument): void {
  if (!('content' in input)) {
    throw new SDKErrors.ContentMissingError()
  } else {
    Content.verifyDataStructure(input.content)
  }
  if (!input.content.holder) {
    throw new SDKErrors.HolderMissingError()
  }
  if (!Array.isArray(input.evidenceIds)) {
    throw new SDKErrors.EvidenceMissingError()
  }
  if (!('contentNonceMap' in input)) {
    throw new SDKErrors.ContentNonceMapMissingError()
  }
  if (typeof input.contentNonceMap !== 'object')
    throw new SDKErrors.ContentNonceMapMalformedError()
  Object.entries(input.contentNonceMap).forEach(([digest, nonce]) => {
    DataUtils.verifyIsHex(digest, 256)
    if (!digest || typeof nonce !== 'string' || !nonce)
      throw new SDKErrors.ContentNonceMapMalformedError()
  })
  if (!('contentHashes' in input)) {
    throw new SDKErrors.DataStructureError('content hashes not provided')
  }
}

/**
 *  Checks the [[Document]] with a given [[SchemaType]] to check if the claim meets the [[schema]] structure.
 *
 * @param document A [[Document]] object of an anchored content used for verification.
 * @param schema A [[Schema]] to verify the [[Content]] structure.
 */

export function verifyAgainstSchema(
  document: IDocument,
  schema: ISchema
): void {
  verifyDataStructure(document)
  verifyContentAganistSchema(document.content.contents, schema)
}

/**
 * Verifies the signature of the [[IDocumentPresentation]].
 * the signature over the presentation **must** be generated with the DID in order for the verification to be successful.
 *
 * @param input - The [[IPresentation]].
 * @param verificationOpts Additional verification options.
 * @param verificationOpts.didResolveKey - The function used to resolve the claimer's key. Defaults to [[resolveKey]].
 * @param verificationOpts.challenge - The expected value of the challenge. Verification will fail in case of a mismatch.
 */
export async function verifySignature(
  input: IDocumentPresentation,
  {
    challenge,
    didResolveKey = resolveKey,
  }: {
    challenge?: string
    didResolveKey?: DidResolveKey
  } = {}
): Promise<void> {
  const { holderSignature } = input
  if (challenge && challenge !== holderSignature.challenge)
    throw new SDKErrors.SignatureUnverifiableError(
      'Challenge differs from expected'
    )

  const signingData = makeSigningData(input, holderSignature.challenge)
  await verifyDidSignature({
    ...signatureFromJson(holderSignature),
    message: signingData,
    // check if credential owner matches signer
    expectedSigner: input.content.holder,
    expectedVerificationMethod: 'authentication',
    didResolveKey,
  })
}

export type Options = {
  evidenceIds?: IDocument[]
  authorization?: IRegistryAuthorization['identifier'] | null
  registry?: IDocument['registry'] | null
}

/**
 * Builds a new  [[IDocument]] object, from a complete set of required parameters.
 *
 * @param content An `IContent` object to build the document for.
 * @param option Container for different options that can be passed to this method.
 * @param option.evidenceIds Array of [[Document]] objects the Issuer include as evidenceIds.
 * @param option.authorization The authrization id of the Issuer, which should be used in anchoring the document.
 * @param option.registry Identifier of the registry this document is linked to.
 * @returns A new [[IDocument]] object.
 */
export function fromContent(
  content: IContent,
  { evidenceIds = [], authorization = null, registry = null }: Options = {}
): IDocument {
  const { hashes: contentHashes, nonceMap: contentNonceMap } =
    Content.hashContents(content)
  const documentHash = calculateDocumentHash({
    evidenceIds,
    contentHashes,
  })
  const document = {
    content,
    contentHashes,
    contentNonceMap,
    evidenceIds: evidenceIds || [],
    authorization: authorization,
    registry: registry,
    documentHash,
    identifier: Identifier.hashToUri(
      documentHash,
      STREAM_IDENTIFIER,
      STREAM_PREFIX
    ),
  }
  verifyDataStructure(document)
  return document
}

type VerifyOptions = {
  schema?: ISchema
  challenge?: string
  didResolveKey?: DidResolveKey
}

/**
 * Verifies data structure & data integrity of a credential object.
 *
 * @param document - The object to check.
 * @param options - Additional parameter for more verification steps.
 * @param options.schema - Schema to be checked against.
 */
export async function verifyDocument(
  document: IDocument,
  { schema }: VerifyOptions = {}
): Promise<void> {
  verifyDataStructure(document)
  verifyDataIntegrity(document)

  if (schema) {
    verifyAgainstSchema(document, schema)
  }
}

/**
 * Verifies data structure, data integrity and the holder's signature of a document presentation.
 *
 * Upon presentation of a document, a verifier would call this function.
 *
 * @param presentation - The object to check.
 * @param options - Additional parameter for more verification steps.
 * @param options.schema - Schema which the included document should be checked against.
 * @param options.challenge -  The expected value of the challenge. Verification will fail in case of a mismatch.
 * @param options.didResolveKey - The function used to resolve the holders's key. Defaults to [[resolveKey]].
 */
export async function verifyPresentation(
  presentation: IDocumentPresentation,
  { schema, challenge, didResolveKey = resolveKey }: VerifyOptions = {}
): Promise<void> {
  await verifyDocument(presentation, { schema })
  await verifySignature(presentation, {
    challenge,
    didResolveKey,
  })
}

/**
 * Type Guard to determine input being of type [[IDocument]].
 *
 * @param input - A potentially only partial [[IDocument]].
 *
 * @returns  Boolean whether input is of type IDocument.
 */
export function isIDocument(input: unknown): input is IDocument {
  try {
    verifyDataStructure(input as IDocument)
  } catch (error) {
    return false
  }
  return true
}

/**
 * Type Guard to determine input being of type [[IDocumentPresentation]].
 *
 * @param input - An [[IDocument]], [[IDocumentPresentation]], or other object.
 *
 * @returns  Boolean whether input is of type IDocumentPresentation.
 */
export function isPresentation(input: unknown): input is IDocumentPresentation {
  return (
    isIDocument(input) &&
    isDidSignature((input as IDocumentPresentation).holderSignature)
  )
}

/**
 * Gets the hash of the document.
 *
 * @param document - The document to get the hash from.
 * @returns The hash of the credential.
 */
export function getHash(document: IDocument): IStream['streamHash'] {
  return document.documentHash
}

/**
 * Gets names of the document's attributes.
 *
 * @param document The document.
 * @returns The set of names.
 */
function getAttributes(document: IDocument): Set<string> {
  return new Set(Object.keys(document.content.contents))
}

/**
 * Creates a public presentation which can be sent to a verifier.
 * This presentation is signed.
 *
 * @param presentationOptions The additional options to use upon presentation generation.
 * @param presentationOptions.document The document to create the presentation for.
 * @param presentationOptions.signCallback The callback to sign the presentation.
 * @param presentationOptions.selectedAttributes All properties of the credential which have been requested by the verifier and therefore must be publicly presented.
 * @param presentationOptions.challenge Challenge which will be part of the presentation signature.
 * If not specified, all attributes are shown. If set to an empty array, we hide all attributes inside the claim for the presentation.
 * @returns A deep copy of the Credential with selected attributes.
 */
export async function createPresentation({
  document,
  signCallback,
  selectedAttributes,
  challenge,
}: {
  document: IDocument
  signCallback: SignCallback
  selectedAttributes?: string[]
  challenge?: string
}): Promise<IDocumentPresentation> {
  // filter attributes that are not in requested attributes
  const excludedClaimProperties = selectedAttributes
    ? Array.from(getAttributes(document)).filter(
        (property) => !selectedAttributes.includes(property)
      )
    : []

  // remove these attributes
  const presentation = removeContentProperties(
    document,
    excludedClaimProperties
  )

  const signature = await signCallback({
    data: makeSigningData(presentation, challenge),
    did: document.content.holder,
    keyRelationship: 'authentication',
  })

  return {
    ...presentation,
    holderSignature: {
      ...signatureToJson(signature),
      ...(challenge && { challenge }),
    },
  }
}