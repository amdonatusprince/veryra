use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::{AccountId, near};
use std::collections::BTreeMap;

/// Tier inside a programme. `revenue_share_bps` is that tier's share of the
/// revenue pool, split evenly across memberships currently in the tier.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Tier {
    pub id: String,
    pub name: String,
    pub xp_threshold: u64,
    pub revenue_share_bps: u16,
    pub access_rights: Vec<String>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Program {
    pub id: String,
    pub owner_id: AccountId,
    pub name: String,
    pub symbol: String,
    pub paused: bool,
    pub tiers: Vec<Tier>,
    pub tier_counts: BTreeMap<String, u64>,
    pub reward_pool: u128,
    pub revenue_pool: u128,
    pub membership_count: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct ProgramView {
    pub id: String,
    pub owner_id: AccountId,
    pub name: String,
    pub symbol: String,
    pub paused: bool,
    pub tiers: Vec<Tier>,
    pub tier_counts: BTreeMap<String, u64>,
    pub reward_pool: U128,
    pub revenue_pool: U128,
    pub membership_count: u64,
    /// Programme artwork copied onto each pass. Stored outside the programme record.
    pub media: Option<String>,
    pub color: Option<String>,
    pub usdc_reward_pool: U128,
    pub usdc_revenue_pool: U128,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Membership {
    pub token_id: TokenId,
    pub program_id: String,
    pub tier_id: String,
    pub xp: u64,
    pub points: u64,
    /// Deterministic account id for this membership. Spendable balance lives in `vault`.
    pub bound_account: Option<AccountId>,
    pub vault: u128,
    pub seq: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct MembershipView {
    pub token_id: TokenId,
    pub program_id: String,
    pub program_name: String,
    pub owner_id: AccountId,
    pub tier_id: String,
    pub tier_name: String,
    pub xp: u64,
    pub points: u64,
    pub xp_to_next: Option<u64>,
    pub bound_account: AccountId,
    pub vault: U128,
    pub access_rights: Vec<String>,
    pub paused: bool,
    pub media: Option<String>,
    pub color: Option<String>,
    /// Spendable mock USDC, 6 decimals, keyed by the token.
    pub usdc_vault: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct AccountView {
    pub token_id: TokenId,
    pub bound_account: AccountId,
    pub controller: AccountId,
    pub vault: U128,
    pub usdc_vault: U128,
    pub program_id: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Activity {
    pub kind: String,
    pub actor: AccountId,
    pub at: u64,
    pub amount: Option<U128>,
    pub memo: Option<String>,
    pub counterpart: Option<AccountId>,
    pub detail: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct AccountingView {
    pub programmes: u64,
    pub memberships: u64,
    pub reward_pool: U128,
    pub revenue_pool: U128,
    pub vaults: U128,
    pub usdc_reward_pool: U128,
    pub usdc_revenue_pool: U128,
    pub usdc_vaults: U128,
}

impl Program {
    pub fn to_view(&self) -> ProgramView {
        ProgramView {
            id: self.id.clone(),
            owner_id: self.owner_id.clone(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            paused: self.paused,
            tiers: self.tiers.clone(),
            tier_counts: self.tier_counts.clone(),
            reward_pool: U128(self.reward_pool),
            revenue_pool: U128(self.revenue_pool),
            membership_count: self.membership_count,
            media: None,
            color: None,
            usdc_reward_pool: U128(0),
            usdc_revenue_pool: U128(0),
        }
    }
}
