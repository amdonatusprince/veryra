use crate::types::*;
use crate::Veyra;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::{env, require, AccountId, NearToken, Promise};
use std::collections::BTreeMap;

impl Veyra {
    pub(crate) fn settle_storage(&self, start: u64) {
        let used = env::storage_usage().saturating_sub(start);
        let cost = env::storage_byte_cost().as_yoctonear().saturating_mul(u128::from(used));
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= cost, "Attach more NEAR for storage");
        let refund = attached - cost;
        if refund > 0 {
            Promise::new(env::predecessor_account_id())
                .transfer(NearToken::from_yoctonear(refund))
                .detach();
        }
    }

    pub(crate) fn must_program(&self, program_id: &str) -> Program {
        self.programs
            .get(&program_id.to_string())
            .unwrap_or_else(|| env::panic_str("Programme not found"))
    }

    pub(crate) fn must_membership(&self, token_id: &TokenId) -> Membership {
        self.memberships
            .get(token_id)
            .unwrap_or_else(|| env::panic_str("Membership not found"))
    }

    pub(crate) fn assert_program_owner(&self, program_id: &str) {
        let program = self.must_program(program_id);
        require!(
            program.owner_id == env::predecessor_account_id(),
            "Only the programme owner"
        );
    }

    pub(crate) fn assert_active(&self, program_id: &str) {
        require!(!self.must_program(program_id).paused, "Programme is paused");
    }

    pub(crate) fn assert_owner_and_active(&self, program_id: &str) {
        self.assert_program_owner(program_id);
        self.assert_active(program_id);
    }

    pub(crate) fn assert_program_owner_of_token(&self, token_id: &TokenId) {
        let membership = self.must_membership(token_id);
        self.assert_program_owner(&membership.program_id);
    }

    pub(crate) fn owner_of(&self, token_id: &TokenId) -> AccountId {
        self.tokens
            .owner_by_id
            .get(token_id)
            .unwrap_or_else(|| env::panic_str("Token not found"))
    }

    pub(crate) fn tokens_of(&self, account_id: &AccountId) -> Vec<TokenId> {
        self.tokens
            .nft_tokens_for_owner(account_id.clone(), None, None)
            .into_iter()
            .map(|token| token.token_id)
            .collect()
    }

    pub(crate) fn tier_of<'a>(&self, program: &'a Program, tier_id: &str) -> Option<&'a Tier> {
        program.tiers.iter().find(|tier| tier.id == tier_id)
    }

    pub(crate) fn tier_for_xp<'a>(tiers: &'a [Tier], xp: u64) -> &'a Tier {
        tiers
            .iter()
            .filter(|tier| tier.xp_threshold <= xp)
            .max_by_key(|tier| tier.xp_threshold)
            .unwrap_or_else(|| env::panic_str("No tier matches this XP"))
    }

    pub(crate) fn account_view(&self, token_id: &TokenId) -> AccountView {
        let membership = self.must_membership(token_id);
        let bound_account = membership
            .bound_account
            .clone()
            .unwrap_or_else(|| env::panic_str("Membership has no bound account"));
        AccountView {
            token_id: token_id.clone(),
            bound_account,
            controller: self.owner_of(token_id),
            vault: U128(membership.vault),
            usdc_vault: U128(self.usdc_vault(token_id)),
            program_id: membership.program_id,
        }
    }

    pub(crate) fn membership_view(&self, token_id: &TokenId) -> Option<MembershipView> {
        let membership = self.memberships.get(token_id)?;
        let program = self.programs.get(&membership.program_id)?;
        let bound_account = membership.bound_account.clone()?;
        let tier = self.tier_of(&program, &membership.tier_id)?.clone();
        let xp_to_next = program
            .tiers
            .iter()
            .filter(|candidate| candidate.xp_threshold > membership.xp)
            .map(|candidate| candidate.xp_threshold)
            .min()
            .map(|threshold| threshold - membership.xp);
        let program_name = program.name.clone();
        let color = self.program_color(&membership.program_id);
        let usdc_vault = self.usdc_vault(token_id);
        let media = self
            .tokens
            .token_metadata_by_id
            .as_ref()
            .and_then(|map| map.get(token_id))
            .and_then(|metadata| metadata.media);
        Some(MembershipView {
            token_id: token_id.clone(),
            program_id: membership.program_id,
            program_name,
            owner_id: self.owner_of(token_id),
            tier_id: membership.tier_id,
            tier_name: tier.name,
            xp: membership.xp,
            points: membership.points,
            xp_to_next,
            bound_account,
            vault: U128(membership.vault),
            access_rights: tier.access_rights.clone(),
            paused: program.paused,
            media,
            color,
            usdc_vault: U128(usdc_vault),
        })
    }

    pub(crate) fn program_view(&self, program: &Program) -> ProgramView {
        let mut view = program.to_view();
        view.media = self.program_media(&program.id);
        view.color = self.program_color(&program.id);
        view.usdc_reward_pool = U128(self.usdc_pool(&program.id, true));
        view.usdc_revenue_pool = U128(self.usdc_pool(&program.id, false));
        view
    }

    pub(crate) fn program_media(&self, program_id: &str) -> Option<String> {
        let bytes = env::storage_read(&media_key(program_id))?;
        String::from_utf8(bytes).ok()
    }

    pub(crate) fn write_program_media(&mut self, program_id: &str, media: &str) {
        env::storage_write(&media_key(program_id), media.as_bytes());
    }

    pub(crate) fn set_token_media(&mut self, token_id: &TokenId, media: &str) {
        let Some(map) = self.tokens.token_metadata_by_id.as_mut() else { return };
        let Some(mut metadata) = map.get(token_id) else { return };
        metadata.media = Some(media.to_string());
        map.insert(token_id, &metadata);
    }

    pub(crate) fn write_metadata(&mut self, token_id: &TokenId) {
        let membership = self.must_membership(token_id);
        let Some(bound) = membership.bound_account else { return };
        let Some(map) = self.tokens.token_metadata_by_id.as_mut() else { return };
        let Some(mut metadata) = map.get(token_id) else { return };
        metadata.extra = Some(format!(
            "{{\"program_id\":\"{}\",\"tier_id\":\"{}\",\"bound_account\":\"{bound}\"}}",
            membership.program_id, membership.tier_id
        ));
        map.insert(token_id, &metadata);
    }

    pub(crate) fn push_history(
        &mut self,
        token_id: &TokenId,
        kind: &str,
        counterpart: Option<AccountId>,
        amount: Option<u128>,
        memo: Option<String>,
        detail: Option<String>,
    ) {
        let activity = Activity {
            kind: kind.to_string(),
            actor: env::predecessor_account_id(),
            at: env::block_timestamp(),
            amount: amount.map(U128),
            memo,
            counterpart,
            detail,
        };
        let mut items = self.history.get(token_id).unwrap_or_default();
        items.push(activity.clone());
        self.history.insert(token_id, &items);
        if let Some(membership) = self.memberships.get(token_id) {
            self.push_program_activity(&membership.program_id, activity);
        }
    }

    pub(crate) fn push_program(&mut self, program_id: &str, kind: &str, amount: Option<u128>, detail: Option<String>) {
        let activity = Activity {
            kind: kind.to_string(),
            actor: env::predecessor_account_id(),
            at: env::block_timestamp(),
            amount: amount.map(U128),
            memo: None,
            counterpart: None,
            detail,
        };
        self.push_program_activity(program_id, activity);
    }

    pub(crate) fn push_program_activity(&mut self, program_id: &str, activity: Activity) {
        let mut items = self.program_history.get(&program_id.to_string()).unwrap_or_default();
        items.push(activity);
        if items.len() > 200 {
            let overflow = items.len() - 200;
            items.drain(0..overflow);
        }
        self.program_history.insert(&program_id.to_string(), &items);
    }

    pub(crate) fn credit_vault(&mut self, token_id: &TokenId, amount: u128, kind: &str) {
        let mut membership = self.must_membership(token_id);
        membership.vault = membership
            .vault
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("Vault overflow"));
        self.total_vault = self
            .total_vault
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("Vault overflow"));
        self.memberships.insert(token_id, &membership);
        self.push_history(token_id, kind, None, Some(amount), None, None);
    }

    pub(crate) fn add_points(&mut self, token_id: &TokenId, points: u64, increase: bool) {
        let mut membership = self.must_membership(token_id);
        if increase {
            membership.points = membership
                .points
                .checked_add(points)
                .unwrap_or_else(|| env::panic_str("Points overflow"));
            membership.xp = membership
                .xp
                .checked_add(points)
                .unwrap_or_else(|| env::panic_str("XP overflow"));
        } else {
            require!(membership.points >= points, "Insufficient points");
            membership.points -= points;
        }
        self.memberships.insert(token_id, &membership);
    }

    pub(crate) fn sync_tier(&mut self, token_id: &TokenId) {
        let membership = self.must_membership(token_id);
        let program = self.must_program(&membership.program_id);
        let next = Self::tier_for_xp(&program.tiers, membership.xp);
        if next.id == membership.tier_id {
            return;
        }
        let previous = membership.tier_id.clone();
        let next_id = next.id.clone();
        let mut program = program;
        let previous_count = program.tier_counts.get(&previous).copied().unwrap_or(0);
        require!(previous_count > 0, "Tier count is already zero");
        program.tier_counts.insert(previous.clone(), previous_count - 1);
        let next_count = program.tier_counts.get(&next_id).copied().unwrap_or(0);
        program.tier_counts.insert(next_id.clone(), next_count + 1);
        let program_id = program.id.clone();
        self.programs.insert(&program_id, &program);

        let mut membership = self.must_membership(token_id);
        membership.tier_id = next_id.clone();
        self.memberships.insert(token_id, &membership);
        self.write_metadata(token_id);
        self.push_history(
            token_id,
            "tier_changed",
            None,
            None,
            None,
            Some(format!("{previous} -> {next_id}")),
        );
    }

    pub(crate) fn recompute_tiers(&mut self, program_id: &str) {
        let token_ids = self.program_tokens.get(&program_id.to_string()).unwrap_or_default();
        for token_id in token_ids {
            self.sync_tier(&token_id);
        }
    }

    pub(crate) fn usdc_token(&self) -> AccountId {
        let bytes = env::storage_read(b"veyra.usdc.token").unwrap_or_else(|| env::panic_str("Mock USDC is not configured"));
        String::from_utf8(bytes)
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or_else(|| env::panic_str("Mock USDC is not configured"))
    }

    pub(crate) fn usdc_vault(&self, token_id: &TokenId) -> u128 {
        read_u128(&scoped_key(b"veyra.u.v.", token_id))
    }

    pub(crate) fn usdc_pool(&self, program_id: &str, rewards: bool) -> u128 {
        let prefix = if rewards { b"veyra.u.r." } else { b"veyra.u.e." };
        read_u128(&scoped_key(prefix, program_id))
    }

    pub(crate) fn program_color(&self, program_id: &str) -> Option<String> {
        env::storage_read(&scoped_key(b"veyra.color.", program_id)).and_then(|bytes| String::from_utf8(bytes).ok())
    }

    pub(crate) fn write_program_color(&mut self, program_id: &str, color: &str) {
        env::storage_write(&scoped_key(b"veyra.color.", program_id), color.as_bytes());
    }

    pub(crate) fn credit_usdc_vault(&mut self, token_id: &TokenId, amount: u128) {
        let next = self.usdc_vault(token_id).checked_add(amount).unwrap_or_else(|| env::panic_str("Vault overflow"));
        write_u128(&scoped_key(b"veyra.u.v.", token_id), next);
        write_u128(b"veyra.u.tv", read_u128(b"veyra.u.tv").saturating_add(amount));
    }

    pub(crate) fn debit_usdc_vault(&mut self, token_id: &TokenId, amount: u128) {
        let current = self.usdc_vault(token_id);
        require!(current >= amount, "Insufficient vault");
        write_u128(&scoped_key(b"veyra.u.v.", token_id), current - amount);
        write_u128(b"veyra.u.tv", read_u128(b"veyra.u.tv").saturating_sub(amount));
    }

    pub(crate) fn credit_usdc_pool(&mut self, program_id: &str, rewards: bool, amount: u128) {
        let prefix: &[u8] = if rewards { b"veyra.u.r." } else { b"veyra.u.e." };
        let total_key: &[u8] = if rewards { b"veyra.u.tr" } else { b"veyra.u.te" };
        let next = self.usdc_pool(program_id, rewards).checked_add(amount).unwrap_or_else(|| env::panic_str("Pool overflow"));
        write_u128(&scoped_key(prefix, program_id), next);
        write_u128(total_key, read_u128(total_key).saturating_add(amount));
    }

    pub(crate) fn debit_usdc_pool(&mut self, program_id: &str, rewards: bool, amount: u128) {
        let current = self.usdc_pool(program_id, rewards);
        require!(current >= amount, if rewards { "Insufficient reward pool" } else { "Insufficient revenue pool" });
        let prefix: &[u8] = if rewards { b"veyra.u.r." } else { b"veyra.u.e." };
        let total_key: &[u8] = if rewards { b"veyra.u.tr" } else { b"veyra.u.te" };
        write_u128(&scoped_key(prefix, program_id), current - amount);
        write_u128(total_key, read_u128(total_key).saturating_sub(amount));
    }

    pub(crate) fn transfer_usdc(&self, receiver: AccountId, amount: u128) {
        let args = near_sdk::serde_json::json!({
            "receiver_id": receiver,
            "amount": U128(amount),
            "memo": null,
        });
        Promise::new(self.usdc_token())
            .function_call(
                "ft_transfer".to_string(),
                near_sdk::serde_json::to_vec(&args).unwrap(),
                NearToken::from_yoctonear(1),
                near_sdk::Gas::from_tgas(40),
            )
            .detach();
    }

    pub(crate) fn mint_pass(
        &mut self,
        program_id: String,
        receiver_id: AccountId,
        tier_id: Option<String>,
        title: Option<String>,
        description: Option<String>,
    ) -> MembershipView {
        let program = self.must_program(&program_id);
        require!(!program.paused, "Programme is paused");
        let tier = match tier_id {
            Some(id) => program
                .tiers
                .iter()
                .find(|tier| tier.id == id)
                .unwrap_or_else(|| env::panic_str("Tier not found"))
                .clone(),
            None => program
                .tiers
                .iter()
                .find(|tier| tier.xp_threshold == 0)
                .unwrap_or_else(|| env::panic_str("Tier not found"))
                .clone(),
        };

        self.next_token += 1;
        let seq = self.next_token;
        let token_id = format!("m{seq}");
        let title = title.unwrap_or_else(|| format!("{} membership", program.name));
        let description = description.unwrap_or_else(|| format!("Programmable membership in {}", program.name));
        let media = self.program_media(&program_id);
        let metadata = TokenMetadata {
            title: Some(title),
            description: Some(description),
            media,
            media_hash: None,
            copies: Some(1),
            issued_at: None,
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };
        self.tokens.internal_mint_with_refund(token_id.clone(), receiver_id.clone(), Some(metadata), None);
        emit_mint(&receiver_id, &token_id);

        let membership = Membership {
            token_id: token_id.clone(),
            program_id: program_id.clone(),
            tier_id: tier.id.clone(),
            xp: tier.xp_threshold,
            points: tier.xp_threshold,
            bound_account: None,
            vault: 0,
            seq,
        };
        self.memberships.insert(&token_id, &membership);

        let mut program = self.must_program(&program_id);
        *program.tier_counts.entry(tier.id.clone()).or_insert(0) += 1;
        program.membership_count += 1;
        self.programs.insert(&program_id, &program);

        let mut tokens = self.program_tokens.get(&program_id).unwrap_or_default();
        tokens.push(token_id.clone());
        self.program_tokens.insert(&program_id, &tokens);
        self.token_order.push(&token_id);

        self.push_history(&token_id, "issued", Some(receiver_id), None, None, None);
        self.ensure_bound(token_id.clone());
        self.membership_view(&token_id).unwrap()
    }

    pub(crate) fn ensure_bound(&mut self, token_id: TokenId) -> AccountView {
        let mut membership = self.must_membership(&token_id);
        if membership.bound_account.is_none() {
            let account = bound_account_id(membership.seq);
            membership.bound_account = Some(account.clone());
            self.memberships.insert(&token_id, &membership);
            self.write_metadata(&token_id);
            self.push_history(
                &token_id,
                "bound",
                Some(account),
                None,
                None,
                Some("Account control follows the NFT".to_string()),
            );
        }
        self.account_view(&token_id)
    }

    pub(crate) fn after_transfer(&mut self, token_id: &TokenId, previous_owner: AccountId, receiver_id: AccountId, memo: Option<String>) {
        self.push_history(
            token_id,
            "transferred",
            Some(receiver_id),
            None,
            memo,
            Some(format!("Previous controller {previous_owner}")),
        );
    }
}

pub(crate) fn scoped_key(prefix: &[u8], id: &str) -> Vec<u8> {
    let mut key = prefix.to_vec();
    key.extend_from_slice(id.as_bytes());
    key
}

pub(crate) fn read_u128(key: &[u8]) -> u128 {
    let Some(bytes) = env::storage_read(key) else { return 0 };
    if bytes.len() != 16 {
        return 0;
    }
    let mut wide = [0u8; 16];
    wide.copy_from_slice(&bytes);
    u128::from_le_bytes(wide)
}

fn write_u128(key: &[u8], value: u128) {
    if value == 0 {
        env::storage_remove(key);
    } else {
        env::storage_write(key, &value.to_le_bytes());
    }
}

fn media_key(program_id: &str) -> Vec<u8> {
    let mut key = b"veyra.media.".to_vec();
    key.extend_from_slice(program_id.as_bytes());
    key
}

pub(crate) fn clean_media(value: &str) -> String {
    let trimmed = value.trim();
    require!(trimmed.len() <= 500, "Image address is too long");
    require!(
        trimmed.starts_with("https://") || trimmed.starts_with("http://localhost") || trimmed.starts_with("http://127.0.0.1"),
        "Image address must start with https://"
    );
    require!(!trimmed.chars().any(char::is_whitespace), "Image address must be a single https address");
    trimmed.to_string()
}

pub(crate) fn assert_one_yocto() {
    require!(env::attached_deposit().as_yoctonear() == 1, "Requires attached deposit of exactly 1 yoctoNEAR");
}

pub(crate) fn bound_account_id(seq: u64) -> AccountId {
    let id = format!("m{seq}.{}", env::current_account_id());
    id.parse().unwrap_or_else(|_| env::panic_str("Bound account id is invalid"))
}

pub(crate) fn assert_slug(value: &str, label: &str) -> String {
    let value = value.trim().to_string();
    require!(value.len() >= 2 && value.len() <= 32, &format!("{label} must be 2-32 characters"));
    let mut chars = value.chars();
    let first = chars.next().unwrap();
    require!(first.is_ascii_lowercase(), &format!("{label} must start with a letter"));
    require!(
        chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'),
        &format!("{label} uses lowercase letters, digits, hyphens, or underscores")
    );
    value
}

pub(crate) fn clean_label(value: &str, max: usize, label: &str) -> String {
    let value = value.trim().to_string();
    require!(!value.is_empty() && value.len() <= max, &format!("{label} is required"));
    value
}

pub(crate) fn validate_tiers(tiers: &[Tier]) {
    require!(!tiers.is_empty(), "Add at least one tier");
    require!(tiers.len() <= 12, "A programme can have at most 12 tiers");
    require!(
        tiers.iter().any(|tier| tier.xp_threshold == 0),
        "Include a tier with an XP threshold of 0"
    );
    let mut ids = BTreeMap::new();
    let mut thresholds = BTreeMap::new();
    let mut bps = 0u32;
    for tier in tiers {
        let id = assert_slug(&tier.id, "Tier id");
        require!(ids.insert(id, ()).is_none(), "Tier ids must be unique");
        require!(thresholds.insert(tier.xp_threshold, ()).is_none(), "XP thresholds must be unique");
        let _ = clean_label(&tier.name, 32, "Tier name");
        bps += u32::from(tier.revenue_share_bps);
        require!(bps <= 10_000, "Tier shares cannot exceed 100%");
        let mut rights = BTreeMap::new();
        for right in &tier.access_rights {
            let right = assert_slug(right, "Access right");
            require!(rights.insert(right, ()).is_none(), "Access rights must be unique within a tier");
        }
    }
}

pub(crate) fn emit_mint(owner: &AccountId, token_id: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_mint\",\"data\":[{{\"owner_id\":\"{owner}\",\"token_ids\":[\"{token_id}\"]}}]}}"
    ));
}
