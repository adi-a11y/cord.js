import * as Cord from '@cord.network/sdk'
import { UUID, Crypto } from '@cord.network/utils'
import { generateKeypairs } from './utils/generateKeypairs'
import { createDid } from './utils/generateDid'
import { createDidName } from './utils/generateDidName'
import { getDidDocFromName } from './utils/queryDidName'
import { ensureStoredSchema } from './utils/generateSchema'
import {
  ensureStoredRegistry,
  addRegistryAdminDelegate,
  addRegistryDelegate,
} from './utils/generateRegistry'
import { createDocument } from './utils/createDocument'
import { createPresentation } from './utils/createPresentation'
import { createStream } from './utils/createStream'
import { verifyPresentation } from './utils/verifyPresentation'
import { revokeCredential } from './utils/revokeCredential'
import { randomUUID } from 'crypto'
import { decryptMessage } from './utils/decrypt_message'
import { encryptMessage } from './utils/encrypt_message'
import { generateRequestCredentialMessage } from './utils/request_credential_message'
import { getChainCredits, addAuthority } from './utils/createAuthorities'
import { createAccount } from './utils/createAccount'
import { updateStream } from './utils/updateDocument'
import { ScoreType , IJournalContent, IRatingInput , EntryType} from '@cord.network/types'

// import type {
//   SignCallback,
//   // DocumenentMetaData,
// } from '@cord.network/types'

function getChallenge(): string {
  return Cord.Utils.UUID.generate()
}

async function main() {
  const networkAddress = 'ws://127.0.0.1:9944'
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)

  const api = Cord.ConfigService.get('api')

  // Step 1: Setup Authority
  // Setup transaction author account - CORD Account.

  console.log(`\n❄️  New Authority`)
  const authorityAuthorIdentity = Crypto.makeKeypairFromUri(
    '//Alice',
    'sr25519'
  )
  console.log('authorityAuthorIdentity\n',authorityAuthorIdentity,'\n')
  // Setup author authority account.
  const { account: authorIdentity } = await createAccount()
  console.log(`🏦  Author (${authorIdentity.type}): ${authorIdentity.address}`)
  await addAuthority(authorityAuthorIdentity, authorIdentity.address)
  console.log(`🔏  Author permissions updated`)
  await getChainCredits(authorityAuthorIdentity, authorIdentity.address, 5)
  console.log(`💸  Author endowed with credits`)
  console.log('✅ Authority created!')

  // Step 2: Setup Identities
  console.log(`\n❄️  Demo Identities (KeyRing)`)

  /* Creating the DIDs for the different parties involved in the demo. */
  // Create Verifier DID
  const { mnemonic: verifierMnemonic, document: verifierDid } = await createDid(
    authorIdentity
  )
  const verifierKeys = generateKeypairs(verifierMnemonic)
  console.log(
    `🏢  Verifier (${verifierDid.assertionMethod![0].type}): ${verifierDid.uri}`
  )
  // Create Holder DID
  const { mnemonic: holderMnemonic, document: holderDid } = await createDid(
    authorIdentity
  )
  const holderKeys = generateKeypairs(holderMnemonic)
  console.log(
    `👩‍⚕️  Holder (${holderDid.assertionMethod![0].type}): ${holderDid.uri}`
  )
  // Create issuer DID
  const { mnemonic: issuerMnemonic, document: issuerDid } = await createDid(
    authorIdentity
  )
  const issuerKeys = generateKeypairs(issuerMnemonic)
  console.log(
    `🏛   Issuer (${issuerDid?.assertionMethod![0].type}): ${issuerDid.uri}`
  )
  const conformingDidDocument = Cord.Did.exportToDidDocument(
    issuerDid,
    'application/json'
  )
  console.dir(conformingDidDocument, {
    depth: null,
    colors: true,
  })


  // Create Delegate One DID
  const { mnemonic: delegateOneMnemonic, document: delegateOneDid } =
    await createDid(authorIdentity)
  
    const delegateOneKeys = generateKeypairs(delegateOneMnemonic)
  
    console.log(
    `🏛   Delegate (${delegateOneDid?.assertionMethod![0].type}): ${
      delegateOneDid.uri
    }`
  )






  console.log('✅ Identities created!')

  // Entities
  const sellerIdentity = Crypto.makeKeypairFromUri('//Entity', 'sr25519')
  console.log(
    `🏛  Seller Entity (${sellerIdentity.type}): ${sellerIdentity.address}`
  )
  await addAuthority(authorityAuthorIdentity, sellerIdentity.address)
  console.log(`🔏  Author permissions updated`)
  await getChainCredits(authorityAuthorIdentity, sellerIdentity.address, 5)

  const { mnemonic: sellerMnemonic, document: sellerDid } =
    await createDid(sellerIdentity)

  const collectorIdentity = Crypto.makeKeypairFromUri('//BuyerApp', 'sr25519')
  console.log(
    `🧑🏻‍💼 Score Collector (${collectorIdentity.type}): ${collectorIdentity.address}`
  )
  await addAuthority(authorityAuthorIdentity, collectorIdentity.address)
  console.log(`🔏  Author permissions updated`)
  await getChainCredits(authorityAuthorIdentity, collectorIdentity.address, 5)
  const { mnemonic: collectorMnemonic, document: collectorDid } =
    await createDid(collectorIdentity)

  const requestorIdentity = Crypto.makeKeypairFromUri('//SellerApp', 'sr25519')
  console.log(
    `👩‍⚕️ Score Requestor (${requestorIdentity.type}): ${requestorIdentity.address}`
  )
  await addAuthority(authorityAuthorIdentity, requestorIdentity.address)
  console.log(`🔏  Author permissions updated`)
  await getChainCredits(authorityAuthorIdentity, requestorIdentity.address, 5)
  const { mnemonic: requestorMnemonic, document: requestorDid } =
  await createDid(requestorIdentity)

  const sellerKeys = generateKeypairs(sellerMnemonic)

  // Step 3: Create a new Registry
//   console.log(`\n❄️  Registry Creation `)
//   const registry = await ensureStoredRegistry(
//     authorIdentity,
//     issuerDid.uri,
//     schema['$id'],
//     async ({ data }) => ({
//       signature: issuerKeys.assertionMethod.sign(data),
//       keyType: issuerKeys.assertionMethod.type,
//     })
//   )

//   let registry;

//   const registryTitle = `Registry: Score - ${randomUUID()}`
//   const registryDetails: Cord.IContents = {
//     title: registryTitle,
//     description: 'Registry for scoring demo',
//   }

//   const registryType: Cord.IRegistryType = {
//     details: registryDetails,
//     creator: issuerDid.uri,
//   }
//   const txRegistry: Cord.IRegistry =
//   Cord.Registry.fromRegistryProperties(registryType)

  
  
//   try{
//     const schemaId = null
//     const tx = api.tx.registry.create(txRegistry.details, schemaId)
//     registry = await Cord.Did.authorizeTx(
//       issuerDid.uri,
//       tx,
//       async ({ data }) => ({
//         signature: issuerKeys.assertionMethod.sign(data),
//         keyType: issuerKeys.assertionMethod.type,
//       }),
//       authorIdentity.address
//     )
//     console.log('txRegistry\n',txRegistry)
//     }
//     catch(e) {
//         console.log('e.message', e.message)
//     }

// Step 3: Create a new Registry
console.log(`\n❄️  Registry Creation `)
// const registry = await ensureStoredRegistry(
//   authorIdentity,
//   issuerDid.uri,
//   schema['$id'],
//   async ({ data }) => ({
//     signature: issuerKeys.assertionMethod.sign(data),
//     keyType: issuerKeys.assertionMethod.type,
//   })
// )

const registryTitle = `Registry v3.${randomUUID().substring(0, 4)}`
const registryDetails: Cord.IContents = {
  title: registryTitle,
  description: 'Registry for for scoring',
}

const registryType: Cord.IRegistryType = {
    details: registryDetails,
    creator: issuerDid.uri,
  }

const txRegistry: Cord.IRegistry =
    Cord.Registry.fromRegistryProperties(registryType)

let registry;
    try {
        await Cord.Registry.verifyStored(txRegistry)
        console.log('Registry already stored. Skipping creation')
      } catch {
        console.log('Regisrty not present. Creating it now...')
        // Authorize the tx.
        // To create a registry without a schema, use the following line instead:
        // const schemaId = null
        const tx = api.tx.registry.create(txRegistry.details, null)
        const extrinsic = await Cord.Did.authorizeTx(
          issuerDid.uri,
          tx,
          async ({ data }) => ({
            signature: issuerKeys.assertionMethod.sign(data),
            keyType: issuerKeys.assertionMethod.type,
          }),
          authorIdentity.address
        )
        console.log('txRegistry\n',txRegistry)
        // Write to chain then return the Schema.
        await Cord.Chain.signAndSubmitTx(extrinsic, authorIdentity)
        registry = txRegistry
      }


  console.log('✅ Registry created!')

  // Step 4: Add Delelegate One as Registry Admin
  console.log(`\n❄️  Registry Admin Delegate Authorization `)
  const registryAuthority = await addRegistryAdminDelegate(
    authorIdentity,
    issuerDid.uri,
    registry['identifier'],
    delegateOneDid.uri,
    async ({ data }) => ({
      signature: issuerKeys.capabilityDelegation.sign(data),
      keyType: issuerKeys.capabilityDelegation.type,
    })
  )
  console.log(`✅ Registry Authorization - ${registryAuthority} - created!`)

//   // Step 4: Add Delelegate Two as Registry Delegate
//   console.log(`\n❄️  Registry Delegate Authorization `)
//   const registryDelegate = await addRegistryDelegate(
//     authorIdentity,
//     issuerDid.uri,
//     registry['identifier'],
//     delegateTwoDid.uri,
//     async ({ data }) => ({
//       signature: issuerKeys.capabilityDelegation.sign(data),
//       keyType: issuerKeys.capabilityDelegation.type,
//     })
//   )
//   console.log(`✅ Registry Delegation - ${registryDelegate} - created!`)

    // Step 2: Create a jounal entry
    console.log(`\n❄️  Journal Entry `)
    let journalContent : IJournalContent = {
      entity: sellerDid.uri.replace('did:cord:', ''),
      uid: UUID.generate().toString(),
      tid: UUID.generate().toString(),
      collector: collectorDid.uri.replace('did:cord:', ''),
      requestor: requestorDid.uri.replace('did:cord:', ''),
      rating_type: ScoreType.overall,
      rating: 10,
      entry_type: EntryType.credit,
      count: 3
    }
    console.dir(journalContent, { depth: null, colors: true })

    const digest = Crypto.coToUInt8(journalContent.toString(),false)
    const root = Crypto.hash(digest)
    const h256String = Crypto.u8aToHex(root)
    console.log('h256String\n',h256String,'\n')

    const auth = registryAuthority.replace('auth:cord:', '')
    console.log('auth\n',auth,'\n')
    const ratingInput: IRatingInput = {journalContent,h256String,auth}

    try{
        let journalCreationExtrinsic = await api.tx.scoring.entries(ratingInput,auth)
        console.log('journalCreationExtrinsic\n',journalCreationExtrinsic,'\n')
  
        
      const authorizedStreamTx = await Cord.Did.authorizeTx(
        delegateOneDid.uri,
        journalCreationExtrinsic,
        async ({ data }) => ({
          signature: delegateOneKeys.assertionMethod.sign(data),
          keyType: delegateOneKeys.assertionMethod.type,
        }),
        authorIdentity.address
      )

      console.log('300\n')
      await Cord.Chain.signAndSubmitTx(authorizedStreamTx, authorIdentity)
    //   console.log('302\n')
    //   console.log('authorizedStreamTx\n',authorizedStreamTx)
    }
    catch(error){
      console.log('Haha! There is an error!\n')
      console.log(error.message)
    }


}
  main()
  .then(() => console.log('\nBye! 👋 👋 👋 '))
  .finally(Cord.disconnect)

process.on('SIGINT', async () => {
  console.log('\nBye! 👋 👋 👋 \n')
  Cord.disconnect()
  process.exit(0)
})