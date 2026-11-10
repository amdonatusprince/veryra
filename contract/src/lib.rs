//! Veyra — programmable ownership on NEAR.
//!
//! A membership is a NEP-171 token plus a vault. The vault is keyed by token id,
//! so rewards, revenue, and the balance stay with the asset when it transfers.

mod internal;
mod types;

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests;

use internal::*;
use near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval;
use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NFT_METADATA_SPEC, NonFungibleTokenMetadataProvider,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::{LazyOption, LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use std::collections::{BTreeMap, HashMap};
use types::*;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
    Programs,
    Memberships,
    History,
    ProgramHistory,
    ProgramTokens,
    TokenOrder,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Veyra {
    pub(crate) tokens: NonFungibleToken,
    pub(crate) metadata: LazyOption<NFTContractMetadata>,
    pub(crate) programs: UnorderedMap<String, Program>,
    pub(crate) memberships: LookupMap<TokenId, Membership>,
    pub(crate) history: LookupMap<TokenId, Vec<Activity>>,
    pub(crate) program_history: LookupMap<String, Vec<Activity>>,
    pub(crate) program_tokens: LookupMap<String, Vec<TokenId>>,
    pub(crate) token_order: Vector<TokenId>,
    pub(crate) next_token: u64,
    pub(crate) total_vault: u128,
}

#[near]
impl Veyra {
    #[init]
    pub fn new(owner_id: AccountId, metadata: NFTContractMetadata) -> Self {
        require!(!env::state_exists(), "Already initialized");
        metadata.assert_valid();
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            programs: UnorderedMap::new(StorageKey::Programs),
            memberships: LookupMap::new(StorageKey::Memberships),
            history: LookupMap::new(StorageKey::History),
            program_history: LookupMap::new(StorageKey::ProgramHistory),
            program_tokens: LookupMap::new(StorageKey::ProgramTokens),
            token_order: Vector::new(StorageKey::TokenOrder),
            next_token: 0,
            total_vault: 0,
        }
    }

    #[init]
    pub fn new_default_meta(owner_id: AccountId) -> Self {
        Self::new(
            owner_id,
            NFTContractMetadata {
                spec: NFT_METADATA_SPEC.to_string(),
                name: "Veyra".to_string(),
                symbol: "VEYRA".to_string(),
                icon: None,
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
        )
    }

    pub fn get_protocol_owner(&self) -> AccountId {
        self.tokens.owner_id.clone()
    }
}

include!("program.rs");
include!("membership.rs");
include!("economy.rs");
include!("access.rs");
include!("nft.rs");
