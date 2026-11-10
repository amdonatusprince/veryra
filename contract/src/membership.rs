#[near]
impl Veyra {
    #[payable]
    pub fn issue_membership(
        &mut self,
        program_id: String,
        receiver_id: AccountId,
        tier_id: Option<String>,
        title: Option<String>,
        description: Option<String>,
    ) -> MembershipView {
        let start = env::storage_usage();
        self.assert_owner_and_active(&program_id);
        let view = self.mint_pass(program_id, receiver_id, tier_id, title, description);
        self.settle_storage(start);
        view
    }

    /// Assigns `m{seq}.{contract}` the first time. Later calls return the same account.
    pub fn bind_account(&mut self, token_id: TokenId) -> AccountView {
        self.assert_program_owner_of_token(&token_id);
        self.ensure_bound(token_id)
    }

    /// Opens a one-time claim. The customer calls `claim_membership` and receives the pass.
    #[payable]
    pub fn open_claim(
        &mut self,
        claim_id: String,
        program_id: String,
        tier_id: Option<String>,
        title: Option<String>,
    ) {
        let start = env::storage_usage();
        self.assert_owner_and_active(&program_id);
        let claim_id = assert_slug(&claim_id, "Claim id");
        let key = scoped_key(b"veyra.claim.", &claim_id);
        require!(env::storage_read(&key).is_none(), "Choose a different claim");
        if let Some(id) = &tier_id {
            let program = self.must_program(&program_id);
            require!(program.tiers.iter().any(|tier| tier.id == *id), "Tier not found");
        }
        let record = format!(
            "{}\n{}\n{}",
            program_id,
            tier_id.unwrap_or_default(),
            title.unwrap_or_default()
        );
        env::storage_write(&key, record.as_bytes());
        self.settle_storage(start);
    }

    pub fn get_claim(&self, claim_id: String) -> Option<String> {
        let bytes = env::storage_read(&scoped_key(b"veyra.claim.", claim_id.trim()))?;
        let text = String::from_utf8(bytes).ok()?;
        let mut lines = text.splitn(3, '\n');
        let program_id = lines.next().unwrap_or("");
        let program = self.programs.get(&program_id.to_string())?;
        Some(format!("{claim_id}|{program_id}|{}|{}", program.name, lines.next().unwrap_or("")))
    }

    #[payable]
    pub fn claim_membership(&mut self, claim_id: String) -> MembershipView {
        let start = env::storage_usage();
        let claim_id = claim_id.trim().to_string();
        let key = scoped_key(b"veyra.claim.", &claim_id);
        let text = env::storage_read(&key).map(|bytes| String::from_utf8(bytes).unwrap_or_default()).unwrap_or_else(|| env::panic_str("Claim not found"));
        env::storage_remove(&key);
        let mut lines = text.splitn(3, '\n');
        let program_id = lines.next().unwrap_or("").to_string();
        let tier_raw = lines.next().unwrap_or("").to_string();
        let title_raw = lines.next().unwrap_or("").to_string();
        require!(self.must_program(&program_id).paused == false, "Programme is paused");
        let tier_id = if tier_raw.is_empty() { None } else { Some(tier_raw) };
        let title = if title_raw.is_empty() { None } else { Some(title_raw) };
        let receiver = env::predecessor_account_id();
        let view = self.mint_pass(program_id, receiver, tier_id, title, None);
        self.settle_storage(start);
        view
    }

    pub fn get_membership(&self, token_id: TokenId) -> Option<MembershipView> {
        self.membership_view(&token_id)
    }

    /// Resolves a token id (`m12`) or the pass account (`m12.contract.near`).
    pub fn find_membership(&self, query: String) -> Option<MembershipView> {
        let query = query.trim().to_string();
        if query.is_empty() {
            return None;
        }
        if self.memberships.get(&query).is_some() {
            return self.membership_view(&query);
        }
        for token_id in self.token_order.iter() {
            if let Some(membership) = self.memberships.get(&token_id) {
                let matches = membership.bound_account.as_ref().map(|account| account.as_str()) == Some(query.as_str());
                if matches {
                    return self.membership_view(&token_id);
                }
            }
        }
        None
    }

    pub fn memberships_for_owner(&self, account_id: AccountId) -> Vec<MembershipView> {
        self.tokens_of(&account_id)
            .into_iter()
            .filter_map(|token_id| self.membership_view(&token_id))
            .collect()
    }

    pub fn memberships_for_program(&self, program_id: String) -> Vec<MembershipView> {
        self.program_tokens
            .get(&program_id)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|token_id| self.membership_view(&token_id))
            .collect()
    }

    pub fn list_memberships(
        &self,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<MembershipView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50).min(100);
        let mut out = Vec::new();
        let mut index = start;
        while index < self.token_order.len() && (out.len() as u64) < limit {
            if let Some(token_id) = self.token_order.get(index) {
                if let Some(view) = self.membership_view(&token_id) {
                    out.push(view);
                }
            }
            index += 1;
        }
        out
    }

    #[payable]
    pub fn transfer_membership(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        memo: Option<String>,
    ) {
        NonFungibleTokenCore::nft_transfer(self, receiver_id, token_id, None, memo);
    }
}
