import * as Cord from '@cord.network/sdk'
import { UUID, Crypto } from '@cord.network/utils'
import { generateKeypairs } from './utils/generateKeypairs'
import { createDid } from './utils/generateDid'
import { addRegistryAdminDelegate } from './utils/generateRegistry'
import { randomUUID } from 'crypto'
import { addAuthority } from './utils/createAuthorities'
import { createAccount } from './utils/createAccount'
import { updateScore } from './utils/updateScore'
import { ScoreType, IJournalContent, EntryType } from '@cord.network/types'
import { base58Decode, base58Encode, blake2AsU8a } from '@polkadot/util-crypto'
async function main() {
  const networkAddress = 'ws://127.0.0.1:56687'
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)

  const api = Cord.ConfigService.get('api')
  let encodedDid = await api.query.did.did('3xjF5679cfFEV67jaJ2KTqmdNGWzf4jQkbWBrmE12ibBKmD1')
  console.log('\n\n\nencodedDid.toString()\n',encodedDid.toString())

  console.log(`\n❄️   New Member`)
  const authorityAuthorIdentity = Crypto.makeKeypairFromUri(
    '//Alice',
    'sr25519'
  )
  // Setup author authority account.
  const { account: authorIdentity } = await createAccount()
  console.log(`🏦  Member (${authorIdentity.type}): ${authorIdentity.address}`)
  await addAuthority(authorityAuthorIdentity, authorIdentity.address)
  console.log(`🔏  Member permissions updated`)
  console.log('✅  Network Member added!')

  // Step 2: Setup Identities
  console.log(`\n❄️   Demo Identities (KeyRing)`)
  const { mnemonic: issuerMnemonic, document: issuerDid } = await createDid(
    authorIdentity
  )
  const issuerKeys = generateKeypairs(issuerMnemonic)
  console.log(
    `🏛   Issuer (${issuerDid?.assertionMethod![0].type}): ${issuerDid.uri}`
  )

  // Create Delegate One DID
  const { mnemonic: delegateOneMnemonic, document: delegateOneDid } =
    await createDid(authorIdentity)

  const delegateOneKeys = generateKeypairs(delegateOneMnemonic)

  console.log(
    `🏛   Delegate (${delegateOneDid?.assertionMethod![0].type}): ${
      delegateOneDid.uri
    }`
  )

  console.log('✅  Identities created!')

  // Entities
  console.log(`\n❄️   Demo Entities`)
  const sellerIdentity = Crypto.makeKeypairFromUri('//Entity', 'sr25519')
  console.log(
    `🏛   Seller Entity (${sellerIdentity.type}): ${sellerIdentity.address}`
  )
  await addAuthority(authorityAuthorIdentity, sellerIdentity.address)

  const { mnemonic: sellerMnemonic, document: sellerDid } = await createDid(
    sellerIdentity
  )

  const collectorIdentity = Crypto.makeKeypairFromUri('//BuyerApp', 'sr25519')
  console.log(
    `🧑🏻‍💼  Score Collector (${collectorIdentity.type}): ${collectorIdentity.address}`
  )
  await addAuthority(authorityAuthorIdentity, collectorIdentity.address)

  const { mnemonic: collectorMnemonic, document: collectorDid } =
    await createDid(collectorIdentity)

  console.log('✅  Entities created!')

  console.log(`\n❄️  Registry Creation `)

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

  let registry
  try {
    await Cord.Registry.verifyStored(txRegistry)
    console.log('Registry already stored. Skipping creation')
  } catch {
    console.log('Regisrty not present. Creating it now...')
    // Authorize the tx.
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
    console.log('\n', txRegistry)
    // Write to chain then return the Schema.
    await Cord.Chain.signAndSubmitTx(extrinsic, authorIdentity)
    registry = txRegistry
  }
  console.log('\n✅ Registry created!')

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
  console.log(`\n✅ Registry Authorization - ${registryAuthority} - created!`)

  console.log(`\n❄️  Journal Entry `)
  let journalContent: IJournalContent = {
    entity: sellerDid.uri.replace('did:cord:', ''),
    tid: UUID.generatev4().toString(),
    collector: collectorDid.uri.replace('did:cord:', ''),
    rating_type: ScoreType.overall,
    rating: 12.116,
    entry_type: EntryType.debit,
    count: 5,
  }
  console.dir(journalContent, { depth: null, colors: true })
  console.log('\n✅ Journal Entry created!')

  console.log('\nAnchoring the score on the blockchain...')
  const scoreIdentifier = await updateScore(
    journalContent,
    registryAuthority,
    authorIdentity,
    delegateOneDid.uri,
    delegateOneKeys
  )

  console.log(
    '\n✅ The score has been successfully anchored on the blockchain \nIdentifier:',
    scoreIdentifier
  )

  console.log('\nTesting fetchAverageScore\n')
  let pertialDidUri = sellerDid.uri.replace('did:cord:','')
  console.log('pertialDidUri',pertialDidUri)

  // let hex = '';
  // for (let i = 0; i < pertialDidUri.length; i++) {
  //   // Get the ASCII code of each character in the string
  //   const charCode = pertialDidUri.charCodeAt(i);
  //   // Convert the ASCII code to a hexadecimal representation with two digits
  //   const hexCode = charCode.toString(16).padStart(2, '0');
  //   // Concatenate the hexadecimal representation
  //   hex += hexCode;
  // }

  // const hexString = '0x' + Buffer.from(pertialDidUri, 'utf-8').toString('hex');
  // const encoder = new TextEncoder();
  // const uint8Array = encoder.encode(pertialDidUri);
  // console.log(uint8Array)
  // const hexString = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join('');
  //let encoded = base58Encode(sellerDid.uri)
  // Cord.Scoring.fetchAverageScore(pertialDidUri,ScoreType)
  try{
    const encode = api.query.scoring.scores(pertialDidUri,`Overall`)
  }
  catch(e){
    console.log(e.message)
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
